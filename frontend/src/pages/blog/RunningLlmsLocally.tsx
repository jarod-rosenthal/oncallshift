import { BlogLayout } from './BlogLayout';

export function RunningLlmsLocally() {
  return (
    <BlogLayout
      title="Running LLMs Locally: A DevOps Engineer's Guide to AI on Your Own Hardware"
      date="January 2025"
      category="AI & Automation"
      readTime="14 min read"
    >
      <p className="lead text-xl text-slate-600 mb-8">
        You don't need a cloud API to run powerful AI models. With the right hardware—or even
        modest hardware—you can run LLMs locally for code generation, log analysis, and automation.
        Here's everything you need to know.
      </p>

      <h2>Why Run LLMs Locally?</h2>

      <p>
        There are compelling reasons to run AI locally instead of using cloud APIs:
      </p>

      <ul>
        <li><strong>Privacy</strong> — Your code, logs, and data never leave your machine</li>
        <li><strong>Cost</strong> — No per-token charges, just electricity</li>
        <li><strong>Latency</strong> — No network round-trips for each request</li>
        <li><strong>Offline</strong> — Works without internet access</li>
        <li><strong>Experimentation</strong> — Try different models freely</li>
        <li><strong>Learning</strong> — Understand how these systems work</li>
      </ul>

      <h2>The Minimum Viable Setup</h2>

      <p>
        Let's start with what you can do with hardware you probably already have:
      </p>

      <h3>CPU-Only (Any Modern Computer)</h3>

      <p>
        Yes, you can run LLMs on CPU. It's slow, but it works:
      </p>

      <pre><code className="language-bash">{`# Install Ollama (the easiest way to start)
curl -fsSL https://ollama.com/install.sh | sh

# Pull a small model (2.7B parameters, ~1.5GB)
ollama pull phi3:mini

# Run it
ollama run phi3:mini

# Or use via API
curl http://localhost:11434/api/generate -d '{
  "model": "phi3:mini",
  "prompt": "Write a bash script to check disk usage"
}'`}</code></pre>

      <table className="w-full border-collapse my-6">
        <thead>
          <tr className="bg-slate-100">
            <th className="border p-2 text-left">Model</th>
            <th className="border p-2 text-left">Size</th>
            <th className="border p-2 text-left">RAM Needed</th>
            <th className="border p-2 text-left">CPU Speed</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className="border p-2">phi3:mini</td>
            <td className="border p-2">2.7B</td>
            <td className="border p-2">4GB</td>
            <td className="border p-2">~5 tokens/sec</td>
          </tr>
          <tr>
            <td className="border p-2">gemma2:2b</td>
            <td className="border p-2">2B</td>
            <td className="border p-2">4GB</td>
            <td className="border p-2">~8 tokens/sec</td>
          </tr>
          <tr>
            <td className="border p-2">qwen2.5-coder:3b</td>
            <td className="border p-2">3B</td>
            <td className="border p-2">4GB</td>
            <td className="border p-2">~4 tokens/sec</td>
          </tr>
        </tbody>
      </table>

      <p>
        At 5 tokens/second, you're waiting 20+ seconds for a paragraph. But for simple tasks
        like explaining a command or generating a short script, it's usable.
      </p>

      <h3>Entry-Level GPU (8GB VRAM)</h3>

      <p>
        An RTX 3060/4060 or similar GPU with 8GB VRAM opens up much more:
      </p>

      <pre><code className="language-bash">{`# Install with GPU support
ollama pull llama3.2:8b

# Check GPU is being used
nvidia-smi  # Should show ollama using VRAM`}</code></pre>

      <table className="w-full border-collapse my-6">
        <thead>
          <tr className="bg-slate-100">
            <th className="border p-2 text-left">Model</th>
            <th className="border p-2 text-left">Size</th>
            <th className="border p-2 text-left">VRAM Needed</th>
            <th className="border p-2 text-left">GPU Speed</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className="border p-2">llama3.2:8b</td>
            <td className="border p-2">8B</td>
            <td className="border p-2">6GB</td>
            <td className="border p-2">~40 tokens/sec</td>
          </tr>
          <tr>
            <td className="border p-2">mistral:7b</td>
            <td className="border p-2">7B</td>
            <td className="border p-2">5GB</td>
            <td className="border p-2">~45 tokens/sec</td>
          </tr>
          <tr>
            <td className="border p-2">codellama:7b</td>
            <td className="border p-2">7B</td>
            <td className="border p-2">5GB</td>
            <td className="border p-2">~45 tokens/sec</td>
          </tr>
          <tr>
            <td className="border p-2">deepseek-coder:6.7b</td>
            <td className="border p-2">6.7B</td>
            <td className="border p-2">5GB</td>
            <td className="border p-2">~50 tokens/sec</td>
          </tr>
        </tbody>
      </table>

      <p>
        At 40+ tokens/second, responses feel nearly instant. This is genuinely useful for
        day-to-day coding assistance.
      </p>

      <h3>Mid-Range GPU (12-16GB VRAM)</h3>

      <p>
        RTX 3080/4070 Ti or similar unlocks larger, more capable models:
      </p>

      <pre><code className="language-bash">{`# Larger models with better reasoning
ollama pull llama3.1:13b
ollama pull codellama:13b
ollama pull qwen2.5-coder:14b`}</code></pre>

      <h3>High-End GPU (24GB+ VRAM)</h3>

      <p>
        RTX 3090/4090, or pro cards like A5000/A6000:
      </p>

      <pre><code className="language-bash">{`# Large models approaching cloud API quality
ollama pull llama3.1:70b-q4_0  # Quantized to fit in 24GB
ollama pull qwen2.5:32b
ollama pull deepseek-coder:33b`}</code></pre>

      <div className="bg-green-50 border-l-4 border-green-600 p-6 my-8">
        <p className="font-semibold text-green-900 mb-2">The sweet spot:</p>
        <p className="text-green-800">
          For most DevOps work, an 8GB GPU running 7-8B parameter models is excellent value.
          You get fast responses for code generation, log analysis, and documentation without
          breaking the bank.
        </p>
      </div>

      <h2>Setting Up Ollama</h2>

      <p>
        Ollama is the easiest path to local LLMs:
      </p>

      <pre><code className="language-bash">{`# Linux/WSL
curl -fsSL https://ollama.com/install.sh | sh

# macOS
brew install ollama

# Start the server (runs on port 11434)
ollama serve

# In another terminal, pull and run models
ollama pull mistral:7b
ollama run mistral:7b "Explain what this bash does: find . -name '*.log' -mtime +7 -delete"`}</code></pre>

      <h3>The Ollama API</h3>

      <p>
        Ollama exposes an OpenAI-compatible API:
      </p>

      <pre><code className="language-bash">{`# Generate completion
curl http://localhost:11434/api/generate -d '{
  "model": "mistral:7b",
  "prompt": "Write a Python script to parse CloudWatch logs",
  "stream": false
}'

# Chat format
curl http://localhost:11434/api/chat -d '{
  "model": "mistral:7b",
  "messages": [
    {"role": "user", "content": "How do I check Kubernetes pod logs?"}
  ]
}'`}</code></pre>

      <h2>Practical DevOps Use Cases</h2>

      <h3>Log Analysis</h3>

      <pre><code className="language-bash">{`#!/bin/bash
# analyze-logs.sh - AI-powered log analysis

LOGS=$(tail -100 /var/log/app/error.log)

curl -s http://localhost:11434/api/generate -d "{
  \"model\": \"mistral:7b\",
  \"prompt\": \"Analyze these error logs and summarize the issues:\\n\\n$LOGS\",
  \"stream\": false
}" | jq -r '.response'`}</code></pre>

      <h3>Code Explanation</h3>

      <pre><code className="language-bash">{`# explain - Shell function to explain code
explain() {
  local code=$(cat "$1")
  curl -s http://localhost:11434/api/generate -d "{
    \"model\": \"codellama:7b\",
    \"prompt\": \"Explain this code:\\n\\n$code\",
    \"stream\": false
  }" | jq -r '.response'
}

# Usage: explain deploy.sh`}</code></pre>

      <h3>Generating Terraform</h3>

      <pre><code className="language-bash">{`# Ask the model to generate IaC
ollama run codellama:7b "Write Terraform for an AWS ALB with:
- HTTPS listener on 443
- HTTP redirect on 80
- Two target groups for blue/green
- Health checks on /health"`}</code></pre>

      <h3>Incident Investigation Assistant</h3>

      <pre><code className="language-python">{`# incident_assistant.py
import requests
import json

def analyze_incident(symptoms: str, logs: str) -> str:
    prompt = f"""You are an SRE investigating a production incident.

Symptoms:
{symptoms}

Recent logs:
{logs}

Provide:
1. Likely root causes (ranked by probability)
2. Suggested investigation steps
3. Potential quick fixes"""

    response = requests.post(
        "http://localhost:11434/api/generate",
        json={
            "model": "mistral:7b",
            "prompt": prompt,
            "stream": False
        }
    )

    return response.json()["response"]`}</code></pre>

      <h2>Quantization: Trading Quality for Size</h2>

      <p>
        Quantization reduces model precision to fit larger models in less VRAM:
      </p>

      <table className="w-full border-collapse my-6">
        <thead>
          <tr className="bg-slate-100">
            <th className="border p-2 text-left">Quantization</th>
            <th className="border p-2 text-left">Size Reduction</th>
            <th className="border p-2 text-left">Quality Impact</th>
            <th className="border p-2 text-left">Use Case</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className="border p-2">Q8_0</td>
            <td className="border p-2">~50%</td>
            <td className="border p-2">Minimal</td>
            <td className="border p-2">When you have enough VRAM</td>
          </tr>
          <tr>
            <td className="border p-2">Q6_K</td>
            <td className="border p-2">~60%</td>
            <td className="border p-2">Very slight</td>
            <td className="border p-2">Good balance</td>
          </tr>
          <tr>
            <td className="border p-2">Q4_K_M</td>
            <td className="border p-2">~75%</td>
            <td className="border p-2">Noticeable for complex tasks</td>
            <td className="border p-2">Fitting bigger models</td>
          </tr>
          <tr>
            <td className="border p-2">Q4_0</td>
            <td className="border p-2">~75%</td>
            <td className="border p-2">Moderate</td>
            <td className="border p-2">Maximum compression</td>
          </tr>
        </tbody>
      </table>

      <pre><code className="language-bash">{`# Pull a specific quantization
ollama pull llama3.1:70b-q4_0  # 70B model squeezed into ~40GB

# For models not on Ollama, use llama.cpp directly
./llama-cli -m model-q4_k_m.gguf -p "Your prompt"`}</code></pre>

      <h2>Hardware Buying Guide</h2>

      <p>
        If you're buying hardware specifically for local LLMs:
      </p>

      <h3>Budget Build (~$300-500)</h3>

      <ul>
        <li>Used RTX 3060 12GB (~$200)</li>
        <li>16GB+ system RAM</li>
        <li>Any modern CPU (inference is GPU-bound)</li>
      </ul>
      <p>
        <em>Runs: 7-8B models well, some 13B models</em>
      </p>

      <h3>Mid-Range Build (~$800-1200)</h3>

      <ul>
        <li>RTX 4070 Ti Super 16GB or RTX 3090 24GB (used)</li>
        <li>32GB+ system RAM</li>
        <li>NVMe SSD for model storage</li>
      </ul>
      <p>
        <em>Runs: 13-30B models, some 70B quantized</em>
      </p>

      <h3>Enthusiast Build (~$2000+)</h3>

      <ul>
        <li>RTX 4090 24GB or dual GPU setup</li>
        <li>64GB+ system RAM</li>
        <li>2TB+ NVMe for model collection</li>
      </ul>
      <p>
        <em>Runs: 70B+ models, multiple models simultaneously</em>
      </p>

      <div className="bg-amber-50 border-l-4 border-amber-600 p-6 my-8">
        <p className="font-semibold text-amber-900 mb-2">Pro tip:</p>
        <p className="text-amber-800">
          VRAM is the bottleneck, not compute. A used RTX 3090 with 24GB VRAM often
          outperforms a new RTX 4070 with 12GB for LLM work.
        </p>
      </div>

      <h2>Model Recommendations for DevOps</h2>

      <p>
        Based on my testing for DevOps-specific tasks:
      </p>

      <table className="w-full border-collapse my-6">
        <thead>
          <tr className="bg-slate-100">
            <th className="border p-2 text-left">Task</th>
            <th className="border p-2 text-left">Best Model</th>
            <th className="border p-2 text-left">Alternative</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className="border p-2">Code generation</td>
            <td className="border p-2">deepseek-coder:6.7b</td>
            <td className="border p-2">qwen2.5-coder:7b</td>
          </tr>
          <tr>
            <td className="border p-2">Bash/shell scripts</td>
            <td className="border p-2">codellama:7b</td>
            <td className="border p-2">mistral:7b</td>
          </tr>
          <tr>
            <td className="border p-2">Terraform/IaC</td>
            <td className="border p-2">qwen2.5-coder:14b</td>
            <td className="border p-2">codellama:13b</td>
          </tr>
          <tr>
            <td className="border p-2">Log analysis</td>
            <td className="border p-2">mistral:7b</td>
            <td className="border p-2">llama3.2:8b</td>
          </tr>
          <tr>
            <td className="border p-2">Documentation</td>
            <td className="border p-2">llama3.1:8b</td>
            <td className="border p-2">gemma2:9b</td>
          </tr>
          <tr>
            <td className="border p-2">General assistant</td>
            <td className="border p-2">llama3.1:8b</td>
            <td className="border p-2">qwen2.5:7b</td>
          </tr>
        </tbody>
      </table>

      <h2>Integration with Your Workflow</h2>

      <h3>IDE Integration</h3>

      <pre><code className="language-text">{`# VS Code with Continue extension
# Settings:
{
  "continue.models": [{
    "title": "Local Mistral",
    "provider": "ollama",
    "model": "mistral:7b"
  }]
}`}</code></pre>

      <h3>Terminal Integration</h3>

      <pre><code className="language-bash">{`# .bashrc / .zshrc
alias ai='ollama run mistral:7b'
alias code-ai='ollama run codellama:7b'

# Quick question function
ask() {
  ollama run mistral:7b "$*"
}`}</code></pre>

      <h2>When to Use Cloud vs Local</h2>

      <p>
        Local LLMs aren't a complete replacement for cloud APIs:
      </p>

      <table className="w-full border-collapse my-6">
        <thead>
          <tr className="bg-slate-100">
            <th className="border p-2 text-left">Use Local</th>
            <th className="border p-2 text-left">Use Cloud API</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className="border p-2">Sensitive code analysis</td>
            <td className="border p-2">Complex multi-step reasoning</td>
          </tr>
          <tr>
            <td className="border p-2">High-volume simple tasks</td>
            <td className="border p-2">Very long context windows</td>
          </tr>
          <tr>
            <td className="border p-2">Offline environments</td>
            <td className="border p-2">State-of-the-art performance needed</td>
          </tr>
          <tr>
            <td className="border p-2">Experimentation</td>
            <td className="border p-2">Production applications</td>
          </tr>
          <tr>
            <td className="border p-2">CI/CD integration</td>
            <td className="border p-2">Consumer-facing features</td>
          </tr>
        </tbody>
      </table>

      <h2>Getting Started Today</h2>

      <ol>
        <li><strong>Install Ollama</strong> — Takes 2 minutes</li>
        <li><strong>Pull phi3:mini</strong> — Works on any hardware</li>
        <li><strong>Try a few prompts</strong> — Get a feel for capabilities</li>
        <li><strong>If useful, upgrade models</strong> — Bigger models = better results</li>
        <li><strong>If you want more, consider GPU</strong> — Used 3060 is great value</li>
      </ol>

      <p>
        The barrier to running AI locally has never been lower. Give it a try—you might be
        surprised how capable a 7B model running on your own hardware can be.
      </p>
    </BlogLayout>
  );
}
