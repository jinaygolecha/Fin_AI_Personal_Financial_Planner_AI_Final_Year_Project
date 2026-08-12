# 🎓 AI-Powered Personal Finance Tracker

> **Final-Year Engineering Project**  
> **Project Owner / Maintainer**: Jinay Golecha (`jinay_golecha`)  
> **Technology Stack**: Python 3.12, Django 5.1.6, PostgreSQL 17, Django REST Framework, Scikit-Learn, Celery, HTML5/CSS3  

---

## 📘 Project Overview

**AI-Powered Personal Finance Tracker** is an intelligent financial management platform designed to automate expense tracking, predict future spending trends, manage group split expenses, and deliver personalized financial recommendations. 

The system leverages Machine Learning (**TF-IDF + Naive Bayes Classifier**), automated NLP voice input parsing, linear regression budgeting projections, and secure role-based access control.

---

## 🚀 Key Features

1. **AI Machine Learning Categorizer**: Automatically predicts transaction categories (Food, Travel, Bills, Shopping, Income, etc.) using TF-IDF text vectorization and Naive Bayes inference.
2. **Voice-Based Expense Logging**: Parses natural language voice commands to extract transaction amounts, categories, and types.
3. **Group Expense & Settlement Splitter**: Split shared bills among group members (equal/custom split), calculate balances, and track payment settlements.
4. **Budgeting & Predictive Insights**: Linear regression model projects future category spending based on historical transaction trends.
5. **Recurring Payments & Reminders**: Tracks upcoming bills and recurring subscriptions with automated reminders.
6. **JWT & Session Authentication**: Multi-layer authentication supporting JSON Web Tokens (`/api/token/`) and secure session management.
7. **CSV Export & Analytics**: Export personal financial transactions and group data to CSV.
8. **Admin Control Dashboard**: Executive administration panel for user management, system metrics, and transaction auditing.

---

## 🛠️ Technology Stack

| Layer | Technologies |
|---|---|
| **Backend Framework** | Python 3.12, Django 5.1.6, Django REST Framework |
| **Database** | PostgreSQL 17 |
| **Machine Learning & AI** | Scikit-Learn (TF-IDF, Naive Bayes, Linear Regression), Joblib, Pandas, NumPy |
| **Authentication** | Django SimpleJWT (Access + Refresh tokens), Django Contrib Auth |
| **Task Queue & Cache** | Celery, Redis, Django Celery Beat |
| **Frontend UI** | Responsive HTML5, Modern CSS3, JavaScript |

---

## 📁 Repository Architecture

```text
Final-Year-Project/
├── backend/                  # Django project configuration & settings
│   ├── settings.py           # Environment-driven settings (PostgreSQL, JWT, CORS)
│   ├── urls.py               # Root URL configuration & API routing
│   └── wsgi.py               # WSGI application entrypoint
├── users/                    # Custom User model, JWT authentication & Profile management
├── group_expenses/           # Group creation, member split, & settlement calculations
├── transactions/             # Core transaction management, voice entry & ML categorizer
├── payments/                 # Recurring payments & Razorpay integration
├── insights/                 # AI budget projections & savings goal tracker
├── notifications/            # User notification management
├── admin_dashboard/          # System administration views and templates
├── frontend/                 # Interactive HTML UI templates & landing page
├── categorizer_train.py      # ML model training script
├── transaction_classifier.pkl# Pre-trained TF-IDF classifier
├── transaction_vectorizer.pkl# Pre-trained text vectorizer
├── transactions_dataset.csv  # Training dataset for transaction categorizer
├── requirements.txt          # Python dependencies
├── .env.example              # Sample environment file template
├── CONTRIBUTING.md           # Collaboration guidelines & branch strategies
└── README.md                 # Project documentation
```

---

## ⚙️ Setup & Installation Instructions (Windows Development)

### 1. Prerequisites
- Python 3.12+
- PostgreSQL 17 (running locally on port 5432)
- Git

### 2. Clone Repository & Setup Virtual Environment
```powershell
cd /d "E:\FINAL_YEAR_PROJECT\Minor Project\Final-Year-Project"

# Create Virtual Environment
python -m venv .venv

# Activate Virtual Environment
.venv\Scripts\activate.bat
```

### 3. Install Dependencies
```powershell
pip install -r requirements.txt
```

### 4. Configure Environment Variables
Copy `.env.example` to `.env` and configure your database credentials:
```ini
SECRET_KEY=django-insecure-your-secret-key
DEBUG=True
ALLOWED_HOSTS=127.0.0.1,localhost

DB_ENGINE=django.db.backends.postgresql
DB_NAME=final_year_project
DB_USER=postgres
DB_PASSWORD=your_postgres_password
DB_HOST=127.0.0.1
DB_PORT=5432

PROJECT_NAME="AI Personal Finance Tracker"
PROJECT_OWNER="Jinay Golecha"
```

### 5. Apply Database Migrations
```powershell
python manage.py makemigrations
python manage.py migrate
```

### 6. Train / Verify ML Categorizer Model (Optional)
```powershell
python categorizer_train.py
```

### 7. Run Automated Tests
```powershell
python manage.py test
```

### 8. Start Development Server
```powershell
python manage.py runserver
```
The application will be accessible at: `http://127.0.0.1:8000/`

---

## 🔗 Key API Endpoints

| Category | Method | Endpoint | Description |
|---|---|---|---|
| **Root Landing Page** | `GET` | `/` | Application Home & Overview |
| **Authentication** | `POST` | `/api/token/` | Obtain JWT Access & Refresh Tokens |
| **Authentication** | `POST` | `/api/token/refresh/` | Refresh JWT Access Token |
| **Users** | `POST` | `/api/users/signup/` | Register new user account |
| **Users** | `POST` | `/api/users/login/` | User Login & JWT generation |
| **Users** | `GET` | `/api/users/user-profile/` | Fetch authenticated user profile |
| **Transactions** | `GET`/`POST`| `/api/transactions/` | List or create transactions |
| **Transactions** | `POST` | `/api/transactions/voice-entry/` | Process voice input text |
| **Transactions** | `GET` | `/api/transactions/export-csv/` | Export user transactions to CSV |
| **Group Expenses** | `GET`/`POST`| `/api/group-expenses/api/groups/` | Manage expense groups |
| **Group Expenses** | `GET`/`POST`| `/api/group-expenses/api/expenses/` | Create group expense & split |
| **Insights** | `GET` | `/api/insights/ai-insights/` | Fetch AI budget recommendations |
| **Admin** | `GET` | `/admin/` | Django Admin Portal |

---

## 📜 Attribution & Acknowledgments

- **Developer & Engineering Owner**: Jinay Golecha (`jinay_golecha`)
- **Original Base Repository Inspiration**: [sugapriya-k/Final-Year-Project](https://github.com/sugapriya-k/Final-Year-Project)
- Open-source packages and frameworks used retain their respective open-source licenses (Django, Scikit-Learn, PyTorch, NLTK).
"# Fin_AI_Personal_Financial_Planner_AI_Final_Year_Project" 
