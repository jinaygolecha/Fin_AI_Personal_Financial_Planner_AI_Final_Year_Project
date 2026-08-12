# Contributing to AI Personal Finance Tracker

Thank you for your interest in contributing to the **AI Personal Finance Tracker** project maintained by **Jinay Golecha** (`jinay_golecha`).

## Branching Strategy

We follow a structured Git branching strategy:
- `main`: Production-ready, stable codebase.
- `develop`: Integration branch for upcoming feature releases.
- `feature/<feature-name>`: Feature development branches.
- `bugfix/<issue-name>`: Dedicated bug fix branches.

## Development Setup

1. **Clone the Repository**:
   ```bash
   git clone https://github.com/jinaygolecha/Final-Year-Project.git
   cd Final-Year-Project
   ```

2. **Set up Virtual Environment**:
   ```bash
   python -m venv .venv
   .venv\Scripts\activate.bat
   ```

3. **Install Dependencies**:
   ```bash
   pip install -r requirements.txt
   ```

4. **Environment Variables**:
   Copy `.env.example` to `.env` and fill in local database credentials.

5. **Run Migrations & Tests**:
   ```bash
   python manage.py migrate
   python manage.py test
   ```

## Commit Conventions

Use concise and meaningful commit messages:
- `feat: Add voice input transaction parser`
- `fix: Enforce authorization checks on group expense querysets`
- `docs: Update API endpoint specifications`
- `refactor: Clean up serializer field definitions`

## Pull Request Process

1. Ensure all unit tests pass locally (`python manage.py test`).
2. Ensure no linting or Django system errors (`python manage.py check`).
3. Open a Pull Request targeting the `develop` branch with a clear summary of changes.
