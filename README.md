# Mistral CLI

A powerful conversational AI assistant for your terminal, powered by Mistral AI's Devstral models.

![Mistral CLI Screenshot](./media/screenshot.png)

## What is Mistral CLI?

Mistral CLI brings the power of AI directly to your terminal. Instead of typing commands, just tell it what you want to do in plain language. It understands your intent and executes the right tools automatically.

### Key Features

- 🤖 **Natural Language Interface** - Just describe what you want to do
- 📝 **Smart File Management** - Create, edit, and manage files through conversation
- ⚡ **Command Execution** - Run bash commands naturally
- 🔍 **Web Search** - Search the internet without leaving your terminal
- 💬 **Beautiful UI** - Clean, responsive terminal interface

## Quick Start

### Prerequisites
- Node.js 16 or higher
- Mistral API key from [Mistral AI](https://mistral.ai)

### Installation

```bash
git clone https://github.com/garciamathias/mistral-cli.git
cd mistral-cli
npm install
npm run build
npm link
```

### Setup Your API Key

```bash
export MISTRAL_API_KEY=your_mistral_api_key_here
```

Or create a `.env` file:
```bash
MISTRAL_API_KEY=your_mistral_api_key_here
LINKUP_API_KEY=your_linkup_api_key_here  # Optional, for web search
```

### Start Using Mistral CLI

```bash
mistral
```

## Example Usage

Just type what you want to do:

```
💬 "Show me what's in the src folder"
💬 "Create a new React component called Button"
💬 "Find all TODO comments in the codebase"
💬 "Run the tests"
💬 "Search the web for the latest Node.js features"
```

## Custom Instructions

Create a `.mistral/MISTRAL.md` file in your project to customize Mistral's behavior:

```markdown
# Project-Specific Instructions

- Always use TypeScript
- Follow our ESLint configuration
- Write tests for new features
- Use functional components for React
```

## Development

```bash
npm run dev        # Run in development mode
npm run build      # Build the project
npm run lint       # Run linter
npm run typecheck  # Check types
```

## License

MIT