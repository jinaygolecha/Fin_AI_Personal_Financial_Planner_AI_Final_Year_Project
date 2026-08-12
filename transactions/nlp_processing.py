import stanza

# Load Stanza NLP pipeline


def process_voice_transaction(voice_text):
    """
    Extracts transaction details (amount, type, category) from voice input.
    """
    doc = nlp(voice_text.lower())

    amount = None
    category = "Other"
    transaction_type = "expense"  # Default assumption

    # Identify words & amounts
    for ent in doc.ents:
        if ent.type == "MONEY":
            try:
                amount = float(ent.text.replace("₹", "").replace(",", "").strip())
            except ValueError:
                amount = 0

    # Identify categories based on keywords
    words = [word.text for word in doc.iter_tokens()]
    
    # Expanded categories
    category_map = {
        "salary": "Salary",
        "deposit": "Salary",
        "bonus": "Salary",
        "food": "Food",
        "restaurant": "Food",
        "dining": "Food",
        "rent": "Rent",
        "shopping": "Shopping",
        "groceries": "Groceries",
        "supermarket": "Groceries",
        "subscription": "Subscription",
        "netflix": "Subscription",
        "spotify": "Subscription",
        "electricity": "Bills",
        "water": "Bills",
        "internet": "Bills",
        "insurance": "Insurance",
        "health": "Insurance",
        "fuel": "Transport",
        "car": "Transport",
        "bus": "Transport",
        "taxi": "Transport",
        "uber": "Transport",
        "loan": "Loans",
        "emi": "Loans",
        "mortgage": "Loans",
        "gift": "Gift",
        "donation": "Donation",
        "charity": "Donation",
        "entertainment": "Entertainment",
        "movie": "Entertainment",
        "concert": "Entertainment",
        "travel": "Travel",
        "flight": "Travel",
        "hotel": "Travel",
        "vacation": "Travel"
    }

    # Assign category if keyword is found
    for word in words:
        if word in category_map:
            category = category_map[word]
            if category == "Salary":
                transaction_type = "income"

    return {
        "amount": amount if amount else 0,
        "transaction_type": transaction_type,
        "category": category
    }
