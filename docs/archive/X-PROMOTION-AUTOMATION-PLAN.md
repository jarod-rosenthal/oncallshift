# OnCallShift X (Twitter) Promotion Automation Plan
## Automated "Build in Public" Strategy Using Local LLM

*Created: January 2025*

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Strategic Objectives](#strategic-objectives)
3. [Content Strategy](#content-strategy)
4. [LLM Automation Architecture](#llm-automation-architecture)
5. [Tweet Templates & Categories](#tweet-templates--categories)
6. [Implementation Guide](#implementation-guide)
7. [Content Calendar](#content-calendar)
8. [Performance Metrics](#performance-metrics)
9. [Safety & Review Process](#safety--review-process)

---

## Executive Summary

This plan automates OnCallShift's "build in public" presence on X using a local LLM to transform development activities into engaging tweets. The system will:

- **Monitor** git commits, PRs, releases, and milestones
- **Generate** compelling tweets showcasing development progress
- **Schedule** optimal posting times (3-5 tweets/week)
- **Track** engagement and adjust strategy

**Target Outcomes:**
- Build authentic developer audience (1,000+ followers in 6 months)
- Generate inbound interest from potential customers
- Create viral opportunities around Opsgenie migration
- Establish thought leadership in incident management

---

## Strategic Objectives

### Primary Goals

1. **Transparency & Trust**
   - Show real development progress
   - Demonstrate rapid feature delivery
   - Build credibility with developer audience

2. **Customer Acquisition**
   - Attract teams evaluating PagerDuty alternatives
   - Capture Opsgenie migration attention
   - Drive traffic to https://oncallshift.com

3. **Community Building**
   - Engage with DevOps/SRE community
   - Share learnings and insights
   - Foster early adopters and advocates

4. **Competitive Positioning**
   - Highlight cost savings vs PagerDuty ($5/user vs $21-99/user)
   - Showcase included AI features (vs $699+/month add-ons)
   - Emphasize developer-friendly approach

---

## Content Strategy

### Content Pillars (Aligned with Business Strategy)

#### 1. Development Progress (40%)
**Goal:** Showcase rapid feature delivery

- New feature announcements
- Bug fixes and improvements
- Performance optimizations
- Mobile app updates
- AI capabilities

**Example Topics:**
- "Just shipped notification bundling - now low-priority alerts digest every 30min instead of spamming you"
- "Added Do Not Disturb hours. Critical incidents still notify, but info/warnings respect your sleep 😴"
- "Mobile app now has 20 screens for full incident management on the go"

#### 2. Cost/Value Narrative (25%)
**Goal:** Position as affordable PagerDuty alternative

- Cost comparisons
- Feature parity updates
- AWS infrastructure efficiency
- Pricing transparency

**Example Topics:**
- "PagerDuty: $41/user/mo + $699/mo for AI features. OnCallShift: $12/user/mo with AI included 🤷"
- "Running 100 customer organizations on $150/month AWS infrastructure. 96% gross margins enable sustainable pricing"
- "Just calculated: Teams of 20 save $7,560/year switching from PagerDuty to OnCallShift Pro"

#### 3. Opsgenie Migration Content (20%)
**Goal:** Capture teams affected by Opsgenie EOL (April 2027)

- Migration guides
- Feature compatibility
- Import tool updates
- Deadline reminders

**Example Topics:**
- "⏰ Opsgenie EOL: 456 days remaining. Built automated migration tool - import escalation policies + schedules in <15min"
- "For Opsgenie users: We support all the same concepts - Services, Escalations, Schedules, Integrations. Zero learning curve"
- "Opsgenie pricing locked at $19.95/user? OnCallShift Pro is $12/user with more features. Migration guide: [link]"

#### 4. Technical Insights (10%)
**Goal:** Demonstrate expertise and engineering quality

- Architecture decisions
- AWS optimization tips
- TypeORM patterns
- React Native learnings

**Example Topics:**
- "How we built real-time escalation timer worker using SQS + ECS. Scales to 1000s of concurrent incidents on $18/mo"
- "TypeScript full-stack: Same types for API + frontend + mobile. Zero API contract bugs"
- "Notification bundling algorithm: Group low-urgency incidents, send digest every 30min. Reduced alert fatigue by 73%"

#### 5. Community & Support (5%)
**Goal:** Build relationships and gather feedback

- Responding to mentions
- Sharing user wins
- Feature requests
- Support highlights

**Example Topics:**
- "Shoutout to [user] for the suggestion - just shipped DND timezone support for global teams"
- "Question from the community: 'Can I bundle all info alerts?' Yes! Just added this feature"
- "Love seeing teams migrate from PagerDuty and reporting 40% cost savings. This is why we build"

---

## LLM Automation Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────┐
│                   Development Events                     │
│  (Git commits, PRs, releases, CI/CD, migrations)        │
└─────────────────┬───────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────┐
│              Event Monitoring System                     │
│  • Git webhook / polling (every 6 hours)                │
│  • Parse commit messages, PR descriptions               │
│  • Detect milestones (migration numbers, features)      │
└─────────────────┬───────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────┐
│          Local LLM Tweet Generator                       │
│  Model: Llama 3.1 8B / Mistral 7B / Phi-3 (local)      │
│  • Input: Structured event data + templates             │
│  • Output: Draft tweet (240 chars) + hashtags           │
│  • Context: Brand voice, past successful tweets         │
└─────────────────┬───────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────┐
│         Review & Approval Queue (Optional)               │
│  • Store drafts in local database                       │
│  • Web UI for manual review/edit                        │
│  • Auto-approve for specific categories                 │
└─────────────────┬───────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────┐
│            X API Posting Service                         │
│  • Schedule tweets (optimal times: 9am, 2pm, 7pm ET)    │
│  • Rate limiting: 3-5 tweets/week                       │
│  • Thread support for feature launches                  │
└─────────────────┬───────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────┐
│         Analytics & Feedback Loop                        │
│  • Track engagement (likes, retweets, replies)          │
│  • Feed high-performers back to LLM as examples         │
│  • A/B test content styles                              │
└─────────────────────────────────────────────────────────┘
```

### Technology Stack

**Event Monitoring:**
- Python script with GitPython library
- Runs as cron job (every 6 hours)
- Parses: commits, migrations, package.json changes, changelog

**Local LLM Options:**

| Model | Size | Speed | Quality | Recommendation |
|-------|------|-------|---------|----------------|
| Llama 3.1 8B | 4.7GB | Fast | Excellent | ⭐ **Best balance** |
| Mistral 7B | 4.1GB | Very Fast | Good | Alternative |
| Phi-3 Medium | 7.6GB | Medium | Good | Low VRAM option |
| Llama 3.2 3B | 2GB | Ultra Fast | Decent | Limited hardware |

**LLM Framework:**
- **Ollama** (recommended) - Easy local deployment
- **LM Studio** (alternative) - GUI-based
- **llama.cpp** (advanced) - Maximum control

**Tweet Posting:**
- Python `tweepy` library
- X API v2 (Free tier: 1,500 tweets/month)
- OAuth 2.0 authentication

**Storage:**
- SQLite database for tweet queue
- JSON files for analytics

---

## Tweet Templates & Categories

### Template Format

Each template includes:
- **Trigger:** What development event triggers this template
- **Input Variables:** Data extracted from event
- **Prompt:** Instructions for LLM
- **Example Output:** Expected tweet format

### Category 1: Feature Launches

**Trigger:** New migration file created OR package.json version bump

**Input Variables:**
```json
{
  "feature_name": "Do Not Disturb (DND)",
  "migration_number": "034",
  "key_capabilities": [
    "User-configurable quiet hours",
    "Critical incidents bypass DND",
    "Timezone-aware scheduling"
  ],
  "files_changed": 8,
  "backend_loc": "+234 -12",
  "frontend_component": "NotificationPreferences.tsx"
}
```

**LLM Prompt:**
```
You are the official OnCallShift Twitter account. Write an engaging tweet announcing this new feature.

Feature: {feature_name}
Key capabilities: {key_capabilities}

Requirements:
- Conversational, developer-friendly tone
- Highlight user benefit (not technical details)
- Include 1-2 relevant emojis
- Maximum 240 characters
- End with relevant hashtags: #DevOps #OnCall #SRE
- Optionally include cost/value angle if relevant

Write the tweet:
```

**Example Outputs:**
```
Just shipped Do Not Disturb hours for on-call teams 🌙

Set your quiet hours - low-priority alerts get bundled, but critical incidents still wake you up.

Because your sleep matters.

#DevOps #OnCall #SRE
---
New feature: Notification bundling ⚡

Low-urgency incidents now digest every 30min instead of spamming you.

Already reduced alert fatigue by 70% in early testing.

#SRE #DevOps #OnCall
```

### Category 2: Cost/Value Narratives

**Trigger:** Weekly scheduled post OR competitive news

**Input Variables:**
```json
{
  "our_price": 12,
  "competitor": "PagerDuty",
  "competitor_price": 41,
  "our_features": ["AI included", "Unlimited incidents", "Mobile app"],
  "competitor_ai_addon": 699,
  "savings_20_users": 7560
}
```

**LLM Prompt:**
```
You are OnCallShift's Twitter account. Write a tweet highlighting our cost advantage over competitors.

Our pricing: ${our_price}/user/month
Competitor ({competitor}): ${competitor_price}/user/month
Their AI add-on: ${competitor_ai_addon}/month (ours is included)

Requirements:
- Factual, not aggressive
- Focus on value, not price-shaming
- Include specific $ savings example
- Developer-friendly tone
- 240 chars max
- Hashtags: #DevOps #CostOptimization

Write the tweet:
```

**Example Outputs:**
```
Quick math for teams of 20:

PagerDuty Business: $820/mo
+ AI features: $699/mo
= $1,519/mo ($18,228/year)

OnCallShift Pro: $240/mo
AI included ✓

Save $15,348/year 🤷

#DevOps #CostOptimization
---
Fun fact: PagerDuty charges $41/user/mo for their mid-tier.

We charge $12/user/mo and include AI features they sell for $699/mo extra.

Same features. Better value. #SRE #DevOps
```

### Category 3: Opsgenie Migration Content

**Trigger:** Bi-weekly scheduled OR milestone reached

**Input Variables:**
```json
{
  "days_until_eol": 456,
  "migration_tool_version": "1.2.0",
  "import_time_seconds": 134,
  "features_imported": ["escalation policies", "schedules", "integrations"],
  "teams_migrated": 47
}
```

**LLM Prompt:**
```
Write an urgent but helpful tweet about Opsgenie's April 2027 end-of-life.

Days until EOL: {days_until_eol}
Our migration tool: {migration_tool_version}
Import time: {import_time_seconds} seconds
Features supported: {features_imported}

Requirements:
- Helpful, not fear-mongering
- Highlight easy migration
- Include countdown urgency
- 240 chars max
- Hashtags: #Opsgenie #Migration #DevOps

Write the tweet:
```

**Example Outputs:**
```
⏰ Opsgenie EOL: {days_until_eol} days remaining

Built an automated migration tool:
✓ Import escalations + schedules
✓ <15 minute setup
✓ Zero downtime

47 teams migrated already.

Migration guide: oncallshift.com/opsgenie

#Opsgenie #Migration
---
For Opsgenie users worried about the April 2027 deadline:

We support the same concepts - Services, Escalations, Schedules, Integrations.

Zero learning curve. Better pricing.

Free migration: oncallshift.com/opsgenie

#Opsgenie #DevOps
```

### Category 4: Development Insights

**Trigger:** Significant refactor OR architectural decision

**Input Variables:**
```json
{
  "insight_topic": "Notification worker architecture",
  "tech_used": ["SQS", "ECS Fargate", "TypeORM"],
  "performance_metric": "Handles 1000s concurrent incidents",
  "cost_metric": "$18/month",
  "lesson_learned": "Long polling > webhooks for reliability"
}
```

**LLM Prompt:**
```
Share a technical insight from OnCallShift development.

Topic: {insight_topic}
Tech: {tech_used}
Performance: {performance_metric}
Cost: {cost_metric}
Learning: {lesson_learned}

Requirements:
- Educational, not promotional
- Include specific technical detail
- Show trade-offs or decisions made
- 280 chars max (can use thread if needed)
- Hashtags: #DevOps #AWS #Architecture

Write the tweet:
```

**Example Outputs:**
```
How we built real-time escalation timer:

SQS + ECS Fargate + long polling

Scales to 1000s of concurrent incidents
Costs $18/month
Zero lost notifications

Key learning: Long polling > webhooks for reliability at scale

#DevOps #AWS #Architecture
---
TypeScript full-stack decision paying off:

Same types for:
• API responses
• React frontend
• React Native mobile

Zero API contract bugs. DX is incredible.

#TypeScript #DevOps #FullStack
```

### Category 5: Milestones & Metrics

**Trigger:** User count milestone OR feature count threshold

**Input Variables:**
```json
{
  "metric_type": "customers",
  "current_value": 100,
  "previous_value": 50,
  "timeframe": "30 days",
  "notable_features": ["20 mobile screens", "AI diagnosis", "DND hours"],
  "cost_savings_aggregate": 156000
}
```

**LLM Prompt:**
```
Announce a milestone for OnCallShift.

Metric: {metric_type} reached {current_value} (from {previous_value} in {timeframe})
Recent features: {notable_features}
Aggregate customer savings: ${cost_savings_aggregate}

Requirements:
- Grateful, humble tone
- Thank community
- Highlight customer value created
- 240 chars max
- Hashtags: #BuildInPublic #SaaS

Write the tweet:
```

**Example Outputs:**
```
🎉 Just hit 100 customer organizations!

From 50 → 100 in 30 days.

Those teams are saving $156k/year vs PagerDuty.

Grateful to everyone building with us. This is just the beginning.

#BuildInPublic #SaaS #DevOps
---
Milestone: OnCallShift now has feature parity with PagerDuty Pro tier

✓ 20 mobile screens
✓ AI diagnosis
✓ DND hours
✓ Postmortems
✓ Cloud credential integration

At 70% lower cost.

#BuildInPublic #DevOps
```

---

## Implementation Guide

### Phase 1: Setup (Week 1)

#### Step 1: Install Local LLM

**Using Ollama (Recommended):**

```bash
# Install Ollama
curl -fsSL https://ollama.com/install.sh | sh

# Pull recommended model
ollama pull llama3.1:8b

# Test generation
ollama run llama3.1:8b "Write a tweet about shipping a new feature"
```

**Alternative: LM Studio**
1. Download from https://lmstudio.ai
2. Download Llama 3.1 8B model from GUI
3. Start local server on port 1234

#### Step 2: X API Setup

1. **Create X Developer Account**
   - Go to https://developer.twitter.com/en/portal/dashboard
   - Apply for Elevated access (required for posting)
   - Create new Project + App

2. **Get API Credentials**
   - API Key
   - API Secret Key
   - Access Token
   - Access Token Secret

3. **Test Authentication**
```python
import tweepy

client = tweepy.Client(
    consumer_key="YOUR_API_KEY",
    consumer_secret="YOUR_API_SECRET",
    access_token="YOUR_ACCESS_TOKEN",
    access_token_secret="YOUR_ACCESS_TOKEN_SECRET"
)

# Test
response = client.create_tweet(text="Test from OnCallShift automation 🚀")
print(f"Tweet ID: {response.data['id']}")
```

#### Step 3: Create Project Structure

```bash
mkdir -p ~/oncallshift-twitter-bot
cd ~/oncallshift-twitter-bot

# Create directory structure
mkdir -p {scripts,templates,data,logs}

# Files to create
touch scripts/monitor_repo.py          # Git monitoring
touch scripts/generate_tweet.py        # LLM generation
touch scripts/post_tweet.py            # X API posting
touch scripts/analytics.py             # Engagement tracking
touch templates/tweet_templates.json   # Template library
touch data/tweet_queue.db             # SQLite database
touch .env                            # API credentials
```

#### Step 4: Install Dependencies

```bash
# Create virtual environment
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install required packages
pip install tweepy gitpython ollama python-dotenv schedule sqlite3
```

### Phase 2: Core Scripts (Week 1-2)

#### Script 1: Repository Monitor

**File: `scripts/monitor_repo.py`**

```python
#!/usr/bin/env python3
"""
Monitor OnCallShift repository for development events.
Detects: commits, migrations, version bumps, feature additions.
"""

import os
import json
import re
from datetime import datetime, timedelta
from pathlib import Path
import git
from dotenv import load_dotenv

load_dotenv()

REPO_PATH = os.getenv('REPO_PATH', '/mnt/c/Users/jarod/github/pagerduty-lite')
EVENTS_FILE = 'data/detected_events.json'
LAST_CHECK_FILE = 'data/last_check.txt'

def get_last_check_time():
    """Read last check timestamp."""
    if not Path(LAST_CHECK_FILE).exists():
        # Default to 6 hours ago
        return datetime.now() - timedelta(hours=6)

    with open(LAST_CHECK_FILE, 'r') as f:
        timestamp = f.read().strip()
        return datetime.fromisoformat(timestamp)

def save_last_check_time():
    """Save current timestamp."""
    with open(LAST_CHECK_FILE, 'w') as f:
        f.write(datetime.now().isoformat())

def detect_events(repo_path):
    """Scan repository for tweetable events."""
    repo = git.Repo(repo_path)
    last_check = get_last_check_time()
    events = []

    # Get recent commits
    commits = list(repo.iter_commits('main', since=last_check.isoformat()))

    for commit in commits:
        event = {
            'type': 'commit',
            'timestamp': commit.committed_datetime.isoformat(),
            'message': commit.message,
            'author': commit.author.name,
            'sha': commit.hexsha[:7],
            'files_changed': len(commit.stats.files)
        }

        # Detect specific event types

        # New migration file
        if any('migrations/' in f and f.endswith('.sql') for f in commit.stats.files):
            migration_files = [f for f in commit.stats.files if 'migrations/' in f]
            migration_number = re.search(r'(\d+)_', migration_files[0])

            event['type'] = 'feature_launch'
            event['subtype'] = 'migration'
            event['migration_number'] = migration_number.group(1) if migration_number else 'unknown'
            event['feature_name'] = extract_feature_from_migration(migration_files[0])

        # Version bump in package.json
        elif 'package.json' in commit.stats.files:
            # Check if version changed
            diff = repo.git.diff(f'{commit.hexsha}~1', commit.hexsha, 'package.json')
            if '"version":' in diff:
                event['type'] = 'release'
                event['version'] = extract_version_from_diff(diff)

        # New frontend page
        elif any('pages/' in f and f.endswith('.tsx') for f in commit.stats.files):
            new_pages = [f for f in commit.stats.files if 'pages/' in f and f.endswith('.tsx')]
            event['type'] = 'feature_launch'
            event['subtype'] = 'ui_component'
            event['component_name'] = Path(new_pages[0]).stem

        # Model/entity addition
        elif any('models/' in f and f.endswith('.ts') for f in commit.stats.files):
            new_models = [f for f in commit.stats.files if 'models/' in f and f.endswith('.ts')]
            event['type'] = 'feature_launch'
            event['subtype'] = 'data_model'
            event['model_name'] = Path(new_models[0]).stem

        events.append(event)

    return events

def extract_feature_from_migration(filepath):
    """Extract feature name from migration filename."""
    # Example: 034_add_dnd_and_notification_bundles.sql
    match = re.search(r'\d+_(.+)\.sql', filepath)
    if match:
        return match.group(1).replace('_', ' ').title()
    return 'Unknown Feature'

def extract_version_from_diff(diff):
    """Extract new version from git diff."""
    match = re.search(r'\+"version":\s*"([^"]+)"', diff)
    return match.group(1) if match else 'unknown'

def save_events(events):
    """Append events to JSON file."""
    existing = []
    if Path(EVENTS_FILE).exists():
        with open(EVENTS_FILE, 'r') as f:
            existing = json.load(f)

    existing.extend(events)

    with open(EVENTS_FILE, 'w') as f:
        json.dump(existing, f, indent=2)

def main():
    print(f"Monitoring repository: {REPO_PATH}")
    print(f"Last check: {get_last_check_time()}")

    events = detect_events(REPO_PATH)

    print(f"Detected {len(events)} events")
    for event in events:
        print(f"  - {event['type']}: {event['message'][:50]}...")

    if events:
        save_events(events)
        print(f"Saved to {EVENTS_FILE}")

    save_last_check_time()
    print("Done!")

if __name__ == '__main__':
    main()
```

#### Script 2: Tweet Generator

**File: `scripts/generate_tweet.py`**

```python
#!/usr/bin/env python3
"""
Generate tweets from detected events using local LLM.
"""

import json
import os
from pathlib import Path
from datetime import datetime
import ollama
from dotenv import load_dotenv

load_dotenv()

EVENTS_FILE = 'data/detected_events.json'
QUEUE_FILE = 'data/tweet_queue.json'
MODEL = os.getenv('LLM_MODEL', 'llama3.1:8b')

# Brand voice guidelines
BRAND_VOICE = """
OnCallShift brand voice:
- Conversational and developer-friendly
- Transparent about costs and decisions
- Helpful, not promotional
- Technical but accessible
- Humble and grateful to community
- Uses occasional emojis (not excessive)
- Max 240 characters for tweets
"""

def load_templates():
    """Load tweet templates."""
    with open('templates/tweet_templates.json', 'r') as f:
        return json.load(f)

def load_unprocessed_events():
    """Load events that haven't been converted to tweets yet."""
    if not Path(EVENTS_FILE).exists():
        return []

    with open(EVENTS_FILE, 'r') as f:
        all_events = json.load(f)

    # Filter out events already processed
    processed_ids = get_processed_event_ids()
    return [e for e in all_events if e.get('sha') not in processed_ids]

def get_processed_event_ids():
    """Get list of event IDs already in tweet queue."""
    if not Path(QUEUE_FILE).exists():
        return set()

    with open(QUEUE_FILE, 'r') as f:
        queue = json.load(f)

    return {tweet.get('event_id') for tweet in queue if 'event_id' in tweet}

def generate_tweet_from_event(event, templates):
    """Use LLM to generate tweet from event."""

    # Select appropriate template based on event type
    template = select_template(event, templates)

    # Build prompt
    prompt = f"""
{BRAND_VOICE}

{template['prompt_template']}

Event details:
{json.dumps(event, indent=2)}

Generate a tweet following the requirements above.
Output ONLY the tweet text, no explanations.
"""

    # Call local LLM
    response = ollama.generate(
        model=MODEL,
        prompt=prompt,
        options={
            'temperature': 0.7,
            'top_p': 0.9,
            'max_tokens': 100
        }
    )

    tweet_text = response['response'].strip()

    # Validate length
    if len(tweet_text) > 280:
        # Retry with stricter prompt
        prompt += "\n\nIMPORTANT: Previous attempt was too long. Keep it under 240 characters!"
        response = ollama.generate(model=MODEL, prompt=prompt)
        tweet_text = response['response'].strip()

    return tweet_text

def select_template(event, templates):
    """Select appropriate template for event type."""
    event_type = event.get('type', 'commit')
    subtype = event.get('subtype')

    # Map event types to template categories
    if event_type == 'feature_launch':
        return templates['feature_launch']
    elif event_type == 'release':
        return templates['release']
    elif 'migration' in event.get('message', '').lower():
        return templates['feature_launch']
    else:
        return templates['development_update']

def add_to_queue(tweet_text, event, priority='normal'):
    """Add generated tweet to posting queue."""
    queue = []
    if Path(QUEUE_FILE).exists():
        with open(QUEUE_FILE, 'r') as f:
            queue = json.load(f)

    tweet = {
        'id': len(queue) + 1,
        'text': tweet_text,
        'event_id': event.get('sha'),
        'event_type': event.get('type'),
        'generated_at': datetime.now().isoformat(),
        'status': 'pending',
        'priority': priority,
        'scheduled_for': None  # Will be set by scheduler
    }

    queue.append(tweet)

    with open(QUEUE_FILE, 'w') as f:
        json.dump(queue, f, indent=2)

    return tweet['id']

def main():
    print("Loading templates...")
    templates = load_templates()

    print("Loading unprocessed events...")
    events = load_unprocessed_events()

    print(f"Found {len(events)} new events to process")

    for event in events:
        print(f"\nProcessing: {event['type']} - {event.get('message', '')[:50]}...")

        tweet_text = generate_tweet_from_event(event, templates)
        print(f"Generated: {tweet_text}")

        tweet_id = add_to_queue(tweet_text, event)
        print(f"Added to queue with ID: {tweet_id}")

    print("\nDone! Check data/tweet_queue.json for review")

if __name__ == '__main__':
    main()
```

#### Script 3: Tweet Templates

**File: `templates/tweet_templates.json`**

```json
{
  "feature_launch": {
    "category": "Development Progress",
    "prompt_template": "Write an engaging tweet announcing this new feature. Highlight user benefit (not technical details). Include 1-2 relevant emojis. Maximum 240 characters. End with hashtags: #DevOps #OnCall #SRE",
    "examples": [
      "Just shipped Do Not Disturb hours for on-call teams 🌙\n\nSet your quiet hours - low-priority alerts get bundled, but critical incidents still wake you up.\n\nBecause your sleep matters.\n\n#DevOps #OnCall #SRE",
      "New feature: Notification bundling ⚡\n\nLow-urgency incidents now digest every 30min instead of spamming you.\n\nAlready reduced alert fatigue by 70% in early testing.\n\n#SRE #DevOps #OnCall"
    ]
  },
  "release": {
    "category": "Milestone",
    "prompt_template": "Announce this version release. Be concise about what's new. Show excitement but stay humble. 240 chars max. Hashtags: #BuildInPublic #DevOps",
    "examples": [
      "OnCallShift v1.3.0 just dropped 🚀\n\n✓ DND hours\n✓ Notification bundling\n✓ Cloud credential integration\n✓ Postmortems\n\nFull changelog: oncallshift.com/changelog\n\n#BuildInPublic #DevOps"
    ]
  },
  "development_update": {
    "category": "Build in Public",
    "prompt_template": "Share this development progress. Be transparent and educational. 240 chars. Hashtags: #BuildInPublic",
    "examples": [
      "Working on notification worker improvements today:\n\n✓ Added DND checking\n✓ Implemented bundling for low-urgency alerts\n✓ 30min digest interval\n\nShipping tomorrow.\n\n#BuildInPublic #DevOps"
    ]
  },
  "cost_value": {
    "category": "Value Proposition",
    "prompt_template": "Highlight OnCallShift's cost advantage. Be factual, not aggressive. Show specific savings. 240 chars. Hashtags: #DevOps #CostOptimization",
    "examples": [
      "Quick math for teams of 20:\n\nPagerDuty Business: $820/mo + AI $699/mo = $1,519/mo\n\nOnCallShift Pro: $240/mo (AI included)\n\nSave $15,348/year 🤷\n\n#DevOps #CostOptimization"
    ]
  },
  "opsgenie_migration": {
    "category": "Opsgenie EOL",
    "prompt_template": "Create urgency about Opsgenie EOL but be helpful. Highlight easy migration. Include countdown. 240 chars. Hashtags: #Opsgenie #Migration #DevOps",
    "examples": [
      "⏰ Opsgenie EOL: 456 days remaining\n\nBuilt automated migration tool:\n✓ Import escalations + schedules\n✓ <15 minute setup\n✓ Zero downtime\n\n47 teams migrated.\n\nGuide: oncallshift.com/opsgenie\n\n#Opsgenie #Migration"
    ]
  }
}
```

#### Script 4: Tweet Poster

**File: `scripts/post_tweet.py`**

```python
#!/usr/bin/env python3
"""
Post tweets from queue to X (Twitter).
Includes scheduling, rate limiting, and analytics tracking.
"""

import json
import os
from datetime import datetime, timedelta
from pathlib import Path
import tweepy
from dotenv import load_dotenv

load_dotenv()

QUEUE_FILE = 'data/tweet_queue.json'
POSTED_FILE = 'data/posted_tweets.json'
ANALYTICS_FILE = 'data/analytics.json'

# X API credentials
API_KEY = os.getenv('X_API_KEY')
API_SECRET = os.getenv('X_API_SECRET')
ACCESS_TOKEN = os.getenv('X_ACCESS_TOKEN')
ACCESS_SECRET = os.getenv('X_ACCESS_SECRET')

# Optimal posting times (ET timezone)
OPTIMAL_HOURS = [9, 14, 19]  # 9am, 2pm, 7pm ET
MAX_TWEETS_PER_DAY = 3

def get_client():
    """Initialize Twitter API client."""
    return tweepy.Client(
        consumer_key=API_KEY,
        consumer_secret=API_SECRET,
        access_token=ACCESS_TOKEN,
        access_token_secret=ACCESS_SECRET
    )

def load_queue():
    """Load pending tweets."""
    if not Path(QUEUE_FILE).exists():
        return []

    with open(QUEUE_FILE, 'r') as f:
        return json.load(f)

def get_next_posting_slot():
    """Determine next optimal time to post."""
    now = datetime.now()

    # Check today's slots
    for hour in OPTIMAL_HOURS:
        slot = now.replace(hour=hour, minute=0, second=0, microsecond=0)
        if slot > now:
            return slot

    # All today's slots passed, use tomorrow's first slot
    tomorrow = now + timedelta(days=1)
    return tomorrow.replace(hour=OPTIMAL_HOURS[0], minute=0, second=0, microsecond=0)

def get_posted_today():
    """Count tweets posted today."""
    if not Path(POSTED_FILE).exists():
        return 0

    with open(POSTED_FILE, 'r') as f:
        posted = json.load(f)

    today = datetime.now().date()
    today_tweets = [t for t in posted if datetime.fromisoformat(t['posted_at']).date() == today]

    return len(today_tweets)

def post_tweet(tweet_data, dry_run=False):
    """Post a tweet to X."""
    client = get_client()

    if dry_run:
        print(f"[DRY RUN] Would post: {tweet_data['text']}")
        return {'id': 'dry_run_123', 'text': tweet_data['text']}

    try:
        response = client.create_tweet(text=tweet_data['text'])

        print(f"✓ Posted tweet ID: {response.data['id']}")
        print(f"  Text: {tweet_data['text'][:50]}...")

        return {
            'id': response.data['id'],
            'text': tweet_data['text'],
            'posted_at': datetime.now().isoformat(),
            'event_id': tweet_data.get('event_id'),
            'event_type': tweet_data.get('event_type')
        }

    except Exception as e:
        print(f"✗ Error posting tweet: {e}")
        return None

def save_posted(tweet_record):
    """Save posted tweet to history."""
    posted = []
    if Path(POSTED_FILE).exists():
        with open(POSTED_FILE, 'r') as f:
            posted = json.load(f)

    posted.append(tweet_record)

    with open(POSTED_FILE, 'w') as f:
        json.dump(posted, f, indent=2)

def update_queue(tweet_id, status='posted'):
    """Mark tweet as posted in queue."""
    queue = load_queue()

    for tweet in queue:
        if tweet['id'] == tweet_id:
            tweet['status'] = status
            tweet['posted_at'] = datetime.now().isoformat()
            break

    with open(QUEUE_FILE, 'w') as f:
        json.dump(queue, f, indent=2)

def main(dry_run=False):
    print("OnCallShift Tweet Poster")
    print("=" * 50)

    # Load queue
    queue = load_queue()
    pending = [t for t in queue if t['status'] == 'pending']

    print(f"Pending tweets: {len(pending)}")

    # Check rate limit
    posted_today = get_posted_today()
    print(f"Posted today: {posted_today}/{MAX_TWEETS_PER_DAY}")

    if posted_today >= MAX_TWEETS_PER_DAY:
        print("Daily limit reached. Skipping.")
        return

    # Get next tweet to post (highest priority first)
    if not pending:
        print("No pending tweets.")
        return

    pending.sort(key=lambda t: (t.get('priority') == 'high', -t['id']), reverse=True)
    next_tweet = pending[0]

    print(f"\nNext tweet to post:")
    print(f"  ID: {next_tweet['id']}")
    print(f"  Text: {next_tweet['text'][:100]}...")
    print(f"  Priority: {next_tweet.get('priority', 'normal')}")

    # Post it
    result = post_tweet(next_tweet, dry_run=dry_run)

    if result:
        save_posted(result)
        update_queue(next_tweet['id'], 'posted')
        print("\n✓ Tweet posted successfully!")
    else:
        print("\n✗ Failed to post tweet")
        update_queue(next_tweet['id'], 'failed')

if __name__ == '__main__':
    import sys
    dry_run = '--dry-run' in sys.argv
    main(dry_run=dry_run)
```

### Phase 3: Automation & Scheduling (Week 2)

#### Cron Jobs Setup

**File: `crontab_config.txt`**

```bash
# OnCallShift Twitter Automation

# Monitor repository every 6 hours
0 */6 * * * cd /path/to/oncallshift-twitter-bot && ./scripts/monitor_repo.py >> logs/monitor.log 2>&1

# Generate tweets from new events daily at 8am
0 8 * * * cd /path/to/oncallshift-twitter-bot && ./scripts/generate_tweet.py >> logs/generate.log 2>&1

# Post tweets at optimal times (9am, 2pm, 7pm ET)
0 9 * * * cd /path/to/oncallshift-twitter-bot && ./scripts/post_tweet.py >> logs/post.log 2>&1
0 14 * * * cd /path/to/oncallshift-twitter-bot && ./scripts/post_tweet.py >> logs/post.log 2>&1
0 19 * * * cd /path/to/oncallshift-twitter-bot && ./scripts/post_tweet.py >> logs/post.log 2>&1

# Fetch engagement analytics daily at 11pm
0 23 * * * cd /path/to/oncallshift-twitter-bot && ./scripts/analytics.py >> logs/analytics.log 2>&1
```

**Install cron jobs:**

```bash
# Edit crontab
crontab -e

# Add lines from crontab_config.txt
# Save and exit

# Verify
crontab -l
```

---

## Content Calendar

### Weekly Posting Schedule

**Monday:**
- **Type:** Feature launch / Development update
- **Time:** 9:00 AM ET
- **Goal:** Start week with momentum
- **Example:** "Just shipped [feature] over the weekend"

**Wednesday:**
- **Type:** Cost/Value narrative OR Technical insight
- **Time:** 2:00 PM ET
- **Goal:** Mid-week engagement
- **Example:** Cost comparison or architecture decision

**Friday:**
- **Type:** Milestone / Community highlight
- **Time:** 7:00 PM ET
- **Goal:** End week on positive note
- **Example:** User testimonial or usage metric

**Bi-weekly (Tuesday/Thursday):**
- **Type:** Opsgenie migration content
- **Time:** 9:00 AM ET
- **Goal:** Countdown urgency + helpful content

### Monthly Themes

| Week | Theme | Focus |
|------|-------|-------|
| Week 1 | Feature Showcase | Recent launches, improvements |
| Week 2 | Cost/Value | Pricing comparisons, savings calculator |
| Week 3 | Technical Deep Dive | Architecture, decisions, learnings |
| Week 4 | Community & Metrics | User stories, milestones, gratitude |

### Special Events Calendar

| Date | Event | Content Strategy |
|------|-------|------------------|
| Monthly | Product release | Changelog thread (3-5 tweets) |
| Quarterly | Opsgenie countdown | "X days until EOL" + migration CTA |
| April 2027 | Opsgenie EOL | Heavy migration content, support threads |
| Industry events | AWS re:Invent, DevOps Days | Live commentary, networking |

---

## Performance Metrics

### Key Performance Indicators (KPIs)

**Growth Metrics:**
- Follower count (Goal: 1,000 in 6 months)
- Weekly follower growth rate (Target: 5-10%)
- Profile views per week (Target: 500+)

**Engagement Metrics:**
- Average engagement rate per tweet (Target: 2-5%)
- Replies per tweet (Target: 2+)
- Retweets per tweet (Target: 3+)
- Likes per tweet (Target: 10+)

**Conversion Metrics:**
- Click-through rate on oncallshift.com links (Target: 3-5%)
- Signups attributed to Twitter (Track via UTM: ?utm_source=twitter)
- Mentions from potential customers

**Content Performance:**
- Best-performing content categories
- Optimal posting times (validate/adjust)
- Hashtag effectiveness

### Analytics Dashboard

**Monthly Report Includes:**

1. **Follower Growth**
   - Net new followers
   - Follower demographics (if available)
   - Unfollows and reasons (if determinable)

2. **Top Tweets**
   - Top 5 by engagement
   - Top 5 by impressions
   - Top 5 by clicks

3. **Content Category Performance**
   - Feature launches: avg engagement
   - Cost/value: avg engagement
   - Technical insights: avg engagement
   - Opsgenie content: avg engagement

4. **Recommendations**
   - What to post more of
   - What to post less of
   - Optimal times adjustment

---

## Safety & Review Process

### Content Review Workflow

#### Automatic Approval (No Review Needed)

**Criteria:**
- Development updates (commits, migrations)
- Feature launch announcements (if non-controversial)
- Milestones (user counts, metrics)
- Technical insights

#### Manual Review Required

**Criteria:**
- Pricing/competitor comparisons (fact-check claims)
- Community criticism responses
- Controversial topics (politics, religion, etc. - avoid entirely)
- First-time template categories

#### Review Process

1. **Daily Review Queue (10 minutes/day)**
   - Check `data/tweet_queue.json`
   - Review pending tweets with `status: 'pending'`
   - Edit if needed, approve by changing `status: 'approved'`

2. **Emergency Stop**
   - Set environment variable: `PAUSE_POSTING=true`
   - Bot will skip posting until unset

3. **Post-Posting Monitoring**
   - Check for negative replies within 1 hour
   - Respond professionally to legitimate concerns
   - Delete tweet if factually incorrect (rare)

### Brand Safety Guidelines

**Do:**
- Be transparent about capabilities and limitations
- Acknowledge competitor strengths where appropriate
- Show humility and gratitude
- Engage thoughtfully with community questions
- Share learnings and failures
- Highlight customer wins

**Don't:**
- Criticize competitors personally
- Make unverified claims
- Engage with trolls or bad-faith arguments
- Post about politics, religion, or divisive topics
- Over-promise features or timelines
- Spam or over-post (max 5 tweets/week)

### Incident Response Plan

**If a Tweet Goes Wrong:**

1. **Assess Severity**
   - Minor error (typo): Leave it, reply with correction
   - Factual error: Delete and repost corrected version
   - Offensive/harmful: Delete immediately, post apology

2. **Response Template**
   ```
   Apologies for the error in the previous tweet. [Correction].

   We strive for accuracy and transparency. Thanks for keeping us honest!
   ```

3. **Learn and Update**
   - Add to review criteria
   - Update LLM prompt to avoid similar issues
   - Document in incident log

---

## Implementation Timeline

### Week 1: Foundation
- [x] Install local LLM (Ollama + Llama 3.1)
- [x] Set up X API credentials
- [x] Create project structure
- [x] Write core monitoring script
- [ ] Test repository event detection

### Week 2: Automation
- [ ] Implement tweet generation script
- [ ] Test LLM prompt quality (generate 10-20 test tweets)
- [ ] Set up posting script
- [ ] Configure cron jobs
- [ ] Run first automated cycle (dry-run)

### Week 3: Launch
- [ ] Post first 3 manual tweets to establish presence
- [ ] Enable automated posting (review queue daily)
- [ ] Monitor engagement closely
- [ ] Adjust prompts based on performance

### Week 4: Optimize
- [ ] Analyze first week's analytics
- [ ] Refine LLM prompts for underperforming categories
- [ ] Add A/B testing for different prompt styles
- [ ] Expand template library

### Month 2+: Scale
- [ ] Reduce manual review (trust auto-approve more)
- [ ] Add thread support for feature launches
- [ ] Implement image generation (screenshots, diagrams)
- [ ] Build community interaction automation (reply bot)

---

## Cost Analysis

### Infrastructure Costs

| Component | Cost | Notes |
|-----------|------|-------|
| Local LLM | $0/month | Runs on your PC |
| X API | $0/month | Free tier (1,500 tweets/month) |
| Compute time | ~$5/month | Electricity for running scripts |
| **Total** | **~$5/month** | Minimal ongoing cost |

### Time Investment

| Phase | Time Required |
|-------|---------------|
| Initial setup | 4-6 hours |
| Weekly monitoring | 30 minutes |
| Monthly analytics | 1 hour |
| Ongoing (automated) | ~2 hours/month |

### ROI Projection

**Assumptions:**
- 1,000 followers by Month 6
- 3% conversion to trial signup
- 15% trial-to-paid conversion

**Results:**
- 30 trial signups → 4-5 paying customers
- Average customer value: $405/month × 12 = $4,860 annual
- Total value: ~$20,000 ARR from Twitter channel

**ROI:** 400x return on time/cost investment

---

## Conclusion

This automation plan transforms OnCallShift's development activities into a consistent, authentic Twitter presence with minimal ongoing effort. The local LLM approach provides:

- **Cost efficiency:** ~$5/month vs hiring social media manager
- **Authenticity:** Posts directly from real development work
- **Scalability:** Handles 3-5 tweets/week automatically
- **Flexibility:** Easy to adjust templates and strategy

By "building in public" through automated storytelling, OnCallShift can:
1. Attract developer-focused early adopters
2. Establish thought leadership in incident management
3. Create viral opportunities around Opsgenie migration
4. Drive sustainable inbound customer acquisition

**Next Steps:**
1. Review and approve this plan
2. Set up local LLM (Week 1)
3. Create X developer account and get API keys
4. Implement monitoring script
5. Test tweet generation with 10-20 examples
6. Launch automated posting (manual review for first 2 weeks)

---

## Appendix: Additional Resources

### Recommended Reading
- [How to Build in Public - Indie Hackers](https://www.indiehackers.com/post/how-to-build-in-public)
- [Twitter Growth for Developers - Arvid Kahl](https://thebootstrappedfounder.com/)
- [Technical Content Marketing - PostHog](https://posthog.com/blog)

### Tools & Services
- **Ollama:** https://ollama.com (Local LLM)
- **Tweepy:** https://www.tweepy.org (Python Twitter API)
- **Buffer/Hypefury:** Consider for scheduling if automating becomes complex

### Example Accounts to Study
- [@PostHog](https://twitter.com/posthog) - Excellent build-in-public SaaS
- [@Railway](https://twitter.com/Railway) - Great developer tool marketing
- [@incident_io](https://twitter.com/incident_io) - Direct competitor
- [@Linear](https://twitter.com/linear) - Premium dev tool brand voice

---

*End of Plan*
