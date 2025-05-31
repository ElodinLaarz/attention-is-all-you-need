# Attention Is All You Need

Visualization of the Attention Mechanism from
[Attention Is All You Need](https://arxiv.org/abs/1706.03762) paper.

This project provides an interactive visualization of the attention mechanism in transformer models.
It consists of a Flask backend that uses the Hugging Face Transformers library to generate
predictions and extract attention matrices, and an Angular frontend that visualizes the attention
patterns.

## Project Structure

- **Backend**: Python Flask application that serves the transformer model API
- **Frontend**: Angular application that provides the user interface for visualizing attention

## Installation and Setup

### Prerequisites

- Python 3.13+
- Node.js 18+ and npm
- Git

### Clone the Repository

```bash
git clone https://github.com/ElodinLaarz/attention-is-all-you-need
cd attention-is-all-you-need
```

### Root Project Setup

1. **Install root project dependencies**:

```bash
npm install
```

This installs development tools like Prettier, ESLint, and Husky for Git hooks.

### Backend Setup

1. **Create and activate the Conda environment**:

```bash
conda env create -f environment.yml
conda activate attention
```

2. **Manual installation (alternative to conda)**:

If you prefer not to use conda, you can set up a virtual environment and install the required
packages:

```bash
python -m venv venv
source venv/bin/activate  # On Windows, use: venv\Scripts\activate
pip install flask flask-cors torch transformers numpy
```

3. **Start the Flask server**:

```bash
# From the project root
npm run backend:start

# Or directly
cd backend
python app.py
```

The backend server will run on http://127.0.0.1:5000 by default.

### Frontend Setup

1. **Install frontend dependencies**:

```bash
cd frontend
npm install
```

2. **Start the Angular development server**:

```bash
# From the project root
npm run frontend:start

# Or from the frontend directory
cd frontend
npm start
```

The frontend application will be available at http://localhost:4200 by default.

### Running Both Services

You can start both the backend and frontend simultaneously using:

```bash
# From the project root
npm start
```

## Connecting Frontend to Backend

The frontend is pre-configured to connect to the backend at http://127.0.0.1:5000. This
configuration is set in the `ApiService` class located at
`frontend/src/app/services/api.service.ts`.

If you need to modify the backend URL (for example, if you're running the backend on a different
port or host), update the following line in `api.service.ts`:

```typescript
private readonly backendUrl: string = 'http://127.0.0.1:5000';
```

## Usage

1. Start both the backend and frontend servers as described above
2. Open your browser and navigate to http://localhost:4200
3. Enter a text in the input field to visualize attention patterns

The visualization will show how different tokens attend to each other in the transformer model

## Features

- Text prediction using transformer models
- Visualization of attention matrices
- Interactive exploration of attention patterns

## Troubleshooting

### Backend Issues

- If you encounter errors related to missing packages, ensure your environment is activated and all
  dependencies are installed
- Check that the model specified in `backend/app.py` (default: gpt2) is available and can be
  downloaded

### Frontend Issues

- If you see connection errors, ensure the backend server is running and accessible
- Check the browser console for detailed error messages
- Verify that the backend URL in `api.service.ts` matches your backend server configuration

### CORS Issues

- The backend has CORS enabled for all origins. If you're experiencing CORS issues, ensure that the
  Flask-CORS package is installed and properly configured in `app.py`

## Development Workflow

### Code Formatting

This project uses pre-commit hooks to ensure consistent code formatting:

1. **Markdown files** (including README.md) are automatically formatted using Prettier before each
   commit
2. **Python files** are formatted using Black
3. **YAML files** are checked for valid syntax
4. **JavaScript/TypeScript files** are formatted using Prettier and linted with ESLint
5. **CSS/SCSS files** are formatted using Prettier

To set up the complete development environment with all hooks:

```bash
# Install root dependencies (includes Husky for Git hooks)
npm install

# Initialize Husky (if not already done by the prepare script)
npx husky init

# Install pre-commit for Python hooks
pip install pre-commit

# Install the pre-commit hooks
pre-commit install
```

To manually format files:

```bash
# Format all supported files
npm run format

# Format just markdown files
npm run format:md

# Format just JavaScript/TypeScript files
npm run format:js

# Format just CSS/SCSS files
npm run format:css

# Using pre-commit directly for markdown
pre-commit run prettier --files README.md
```

To run all formatters on all files:

```bash
# Using npm
npm run pre-commit

# Using pre-commit directly
pre-commit run --all-files
```

### Running the Application

You can start both the backend and frontend from the root directory:

```bash
# Install dependencies for the root project
npm install

# Install frontend dependencies
cd frontend && npm install && cd ..

# Start both backend and frontend
npm start

# Or start them individually
npm run backend:start
npm run frontend:start

# Build the frontend
npm run frontend:build

# Run frontend tests
npm run frontend:test
```

## License

See the [LICENSE](LICENSE) file for details.
