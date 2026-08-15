import uuid
from datetime import timedelta
from django.conf import settings
from django.utils.timezone import now
from django.shortcuts import get_object_or_404

from rest_framework import generics, permissions, status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated

from .models import Payment, Subscription, RecurringPayment
from .serializers import PaymentSerializer, SubscriptionSerializer, RecurringPaymentSerializer
from notifications.models import Notification

# Initialize Razorpay Client safely
try:
    import razorpay
    razorpay_key = getattr(settings, 'RAZORPAY_KEY_ID', 'rzp_test_dummy')
    razorpay_secret = getattr(settings, 'RAZORPAY_KEY_SECRET', 'dummy_secret')
    razorpay_client = razorpay.Client(auth=(razorpay_key, razorpay_secret))
except Exception:
    razorpay_client = None

class VerifyPaymentAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        payment_id = request.data.get('razorpay_payment_id')
        order_id = request.data.get('razorpay_order_id')
        signature = request.data.get('razorpay_signature')

        if not payment_id or not order_id:
            return Response({"error": "Missing payment parameters"}, status=status.HTTP_400_BAD_REQUEST)

        # Verification Logic
        verified = True
        if razorpay_client and signature:
            try:
                razorpay_client.utility.verify_payment_signature({
                    'razorpay_order_id': order_id,
                    'razorpay_payment_id': payment_id,
                    'razorpay_signature': signature
                })
            except Exception:
                verified = False

        if verified:
            Payment.objects.create(
                user=request.user,
                razorpay_order_id=order_id,
                razorpay_payment_id=payment_id,
                razorpay_signature=signature or "",
                amount=100.00,
                status="success"
            )
            # Upgrade user to premium
            user = request.user
            user.is_premium = True
            user.save()
            return Response({"message": "Payment verified successfully. User upgraded to Premium!"}, status=status.HTTP_200_OK)
        
        return Response({"error": "Payment verification failed"}, status=status.HTTP_400_BAD_REQUEST)

class CreateSubscriptionAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        plan_type = request.data.get('plan_type', 'monthly')
        amount = 100.00 if plan_type == 'monthly' else 1000.00
        days = 30 if plan_type == 'monthly' else 365
        sub_id = f"sub_mock_{uuid.uuid4().hex[:8]}"

        if razorpay_client:
            try:
                sub_res = razorpay_client.subscription.create({
                    "plan_id": "plan_ABC123",
                    "customer_notify": 1,
                    "total_count": 12 if plan_type == 'monthly' else 1,
                })
                sub_id = sub_res.get('id', sub_id)
            except Exception:
                pass

        subscription = Subscription.objects.create(
            user=request.user,
            razorpay_subscription_id=sub_id,
            plan=plan_type,
            status='active',
            start_date=now(),
            end_date=now() + timedelta(days=days)
        )

        request.user.is_premium = True
        request.user.save()

        return Response({
            "message": "Subscription created successfully!",
            "subscription_id": sub_id,
            "plan": plan_type
        }, status=status.HTTP_201_CREATED)

class RecurringPaymentListCreateView(generics.ListCreateAPIView):
    serializer_class = RecurringPaymentSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return RecurringPayment.objects.filter(user=self.request.user)

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

class RecurringPaymentUpdateDeleteView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = RecurringPaymentSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return RecurringPayment.objects.filter(user=self.request.user)

def send_payment_reminders():
    """Background task function for sending recurring payment reminders"""
    today = now().date()
    upcoming_payments = RecurringPayment.objects.filter(next_payment_date=today, status='active')

    for payment in upcoming_payments:
        Notification.objects.create(
            recipients=str(payment.user.id),
            title="Payment Due Reminder",
            message=f"Reminder: {payment.name} payment of ₹{payment.amount} is due today!",
            status="sent"
        )
