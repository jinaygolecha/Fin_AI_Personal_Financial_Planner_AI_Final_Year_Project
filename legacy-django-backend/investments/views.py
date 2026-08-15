from decimal import Decimal
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .models import Portfolio, Investment, Watchlist
from .market_data import MarketDataService
from users.utils import format_inr

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def portfolio_api_view(request):
    user = request.user
    portfolio, _ = Portfolio.objects.get_or_create(user=user)
    investments = Investment.objects.filter(portfolio=portfolio).order_by('-created_at')

    total_invested = Decimal(0)
    current_portfolio_value = Decimal(0)
    items = []

    for inv in investments:
        quote = MarketDataService.get_quote(inv.symbol)
        curr_price = Decimal(str(quote['price']))
        
        cost_basis = inv.quantity * inv.average_buy_price
        curr_val = inv.quantity * curr_price
        pnl = curr_val - cost_basis
        pnl_pct = (pnl / cost_basis * 100) if cost_basis > 0 else 0

        total_invested += cost_basis
        current_portfolio_value += curr_val

        items.append({
            "id": inv.id,
            "symbol": inv.symbol,
            "asset_type": inv.get_asset_type_display(),
            "quantity": float(inv.quantity),
            "average_buy_price": float(inv.average_buy_price),
            "formatted_buy_price": format_inr(inv.average_buy_price),
            "current_price": float(curr_price),
            "formatted_current_price": format_inr(curr_price),
            "total_cost": float(cost_basis),
            "formatted_cost": format_inr(cost_basis),
            "current_value": float(curr_val),
            "formatted_current_value": format_inr(curr_val),
            "pnl": float(pnl),
            "formatted_pnl": format_inr(pnl),
            "pnl_pct": round(float(pnl_pct), 2),
            "market_status": quote['market_status'],
            "timestamp": quote['timestamp']
        })

    portfolio.total_invested = total_invested
    portfolio.current_value = current_portfolio_value
    portfolio.save()

    total_pnl = current_portfolio_value - total_invested
    total_pnl_pct = (total_pnl / total_invested * 100) if total_invested > 0 else 0

    return Response({
        "total_invested": float(total_invested),
        "formatted_total_invested": format_inr(total_invested),
        "current_value": float(current_portfolio_value),
        "formatted_current_value": format_inr(current_portfolio_value),
        "total_pnl": float(total_pnl),
        "formatted_total_pnl": format_inr(total_pnl),
        "total_pnl_pct": round(float(total_pnl_pct), 2),
        "holdings": items
    }, status=status.HTTP_200_OK)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def stock_quote_api_view(request):
    symbol = request.query_params.get("symbol", "RELIANCE")
    quote = MarketDataService.get_quote(symbol)
    return Response(quote, status=status.HTTP_200_OK)

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def buy_investment_api_view(request):
    user = request.user
    portfolio, _ = Portfolio.objects.get_or_create(user=user)
    
    symbol = request.data.get("symbol", "").upper().strip()
    asset_type = request.data.get("asset_type", "STOCK")
    quantity_str = request.data.get("quantity")
    buy_price_str = request.data.get("buy_price")

    if not symbol or not quantity_str or not buy_price_str:
        return Response({"error": "Symbol, quantity, and buy price are required."}, status=status.HTTP_400_BAD_REQUEST)

    try:
        qty = Decimal(str(quantity_str))
        price = Decimal(str(buy_price_str))
        if qty <= 0 or price <= 0:
            return Response({"error": "Quantity and price must be greater than zero."}, status=status.HTTP_400_BAD_REQUEST)
    except Exception:
        return Response({"error": "Invalid numeric values."}, status=status.HTTP_400_BAD_REQUEST)

    investment, created = Investment.objects.get_or_create(
        portfolio=portfolio,
        symbol=symbol,
        defaults={"asset_type": asset_type, "quantity": qty, "average_buy_price": price}
    )

    if not created:
        # Calculate weighted average price
        total_existing_cost = investment.quantity * investment.average_buy_price
        new_cost = qty * price
        investment.quantity += qty
        investment.average_buy_price = (total_existing_cost + new_cost) / investment.quantity
        investment.save()

    return Response({
        "message": f"Successfully bought {qty} units of {symbol} at {format_inr(price)}!",
        "investment_id": investment.id
    }, status=status.HTTP_200_OK)
