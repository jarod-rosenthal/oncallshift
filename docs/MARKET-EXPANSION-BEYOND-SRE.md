# OnCallShift Market Expansion Strategy: Beyond Software/SRE

> **Analysis Date:** December 2024
> **Focus:** Adjacent markets for OnCallShift + Claude Code integration
> **Goal:** Identify under-served markets with time-critical incident coordination needs

---

## Understanding OnCallShift + Claude Code (Current State)

Based on the codebase and architecture:

**OnCallShift Today:**
- **Primary users:** SRE/DevOps teams at small-to-midsize tech companies (10-100 users)
- **Core value:** Modern incident management—on-call scheduling, escalation policies, alert routing, incident timelines, runbooks, postmortems—at 1/3 the cost of PagerDuty/Opsgenie
- **Differentiators:** Mobile-first, 5-minute setup, opinionated workflows (less configuration overhead), AI-powered diagnosis via Anthropic Claude
- **Tech foundation:** Cloud-native (AWS ECS), multi-tenant, real-time escalations, comprehensive audit trails

**Claude Code Integration Potential:**
- **Workflow definition:** Users describe incident routing logic, escalation rules, or notification preferences in natural language; Claude Code generates executable logic
- **Intelligent triage:** Analyzes incoming alert metadata (logs, metrics, service context) to suggest severity, assignment, and response priority
- **Documentation automation:** Generates incident reports, postmortems, compliance summaries from structured timelines and user notes
- **Adaptive playbooks:** Creates or modifies step-by-step response checklists based on incident type, prior resolutions, and evolving context
- **Pattern recognition:** Identifies recurring failure modes, staffing gaps, or emerging trends across incident history

---

## A. Abstract Problem Statement (Generalizable)

**What OnCallShift fundamentally solves, independent of SRE:**

1. **Fragmented alerting:** Incidents arrive via multiple channels (phone, radio, SMS, email, proprietary systems) with no unified view of who's been notified and what they're doing.

2. **Ad-hoc coordination:** Response involves multiple roles/shifts working across time zones or handoffs, but coordination relies on tribal knowledge, manual calls, or spreadsheets—no shared source of truth.

3. **Invisible workflows:** No clear escalation paths, audit trails, or post-incident analysis—just "we handled it" and hope nothing was missed for compliance or learning.

4. **High cognitive load during crisis:** Responders must remember complex procedures, context-switch between systems, and manually log everything while under time pressure.

5. **Opaque handoffs & shift changes:** Incoming responders lack structured briefings; critical context lives in someone's head or scattered chat logs.

6. **Stale or static playbooks:** Response procedures exist as PDFs or wiki pages that don't adapt to new information and require manual updates by overworked ops staff.

**Generalized problem statement:**
*Any 24/7 operation with time-critical incidents, multi-person coordination, and compliance/audit requirements suffers when relying on legacy communication tools (radios, phones, email) and static documentation (spreadsheets, PDFs). They need a unified system for alerting, escalation, timeline tracking, and intelligent automation—especially when incidents vary in complexity and require adaptive response.*

---

## B. Long List of Candidate Markets (15 Markets)

### 1. **Emergency Medical Services (EMS) / Ambulance Dispatch**
- **Who's on call:** Paramedics, EMTs, dispatchers, shift supervisors, backup crews
- **Typical incidents:** Medical emergencies (cardiac arrest, trauma, overdose), mass casualty events, interfacility transfers
- **Current tools:** Computer-Aided Dispatch (CAD) systems (e.g., Hexagon, Motorola), radio, paper logs, Excel for shift schedules

### 2. **Hospital Rapid Response Teams (Code Blue, Stroke Alerts)**
- **Who's on call:** Code team physicians, nurses, respiratory therapists, pharmacists, anesthesiologists
- **Typical incidents:** Cardiac arrest (Code Blue), stroke alerts, sepsis alerts, trauma activations
- **Current tools:** Overhead paging systems, hospital phones, pagers (!), Epic/Cerner EMR alerts (clunky)

### 3. **Utilities & Critical Infrastructure (Power, Water, Telecom)**
- **Who's on call:** Field technicians, grid operators, engineers, emergency response managers
- **Typical incidents:** Power outages, water main breaks, gas leaks, fiber cuts, transformer failures
- **Current tools:** SCADA systems, legacy work order management (Maximo, SAP PM), phone trees, email

### 4. **Manufacturing & Industrial Plant Operations**
- **Who's on call:** Plant operators, maintenance techs, safety officers, shift managers
- **Typical incidents:** Equipment failures, safety alarms, environmental spills, production line stoppages
- **Current tools:** DCS/SCADA, paper logbooks, spreadsheets, SMS alerts, Slack/Teams (ad-hoc)

### 5. **Campus Security & Public Safety (Universities, Corporate Campuses)**
- **Who's on call:** Security officers, campus police, facilities staff, EHS coordinators
- **Typical incidents:** Medical emergencies, security threats, building alarms, weather events, protests
- **Current tools:** Physical security systems (Genetec, Milestone), radio, shared Google Sheets, email chains

### 6. **Hotel & Hospitality Operations**
- **Who's on call:** Front desk, engineering/maintenance, housekeeping supervisors, duty managers
- **Typical incidents:** Guest emergencies (medical, safety), equipment failures (HVAC, elevators), VIP requests, event issues
- **Current tools:** Property management systems (Opera, Maestro), radios, paper logs, WhatsApp groups

### 7. **Property Management (Commercial Real Estate, Multi-Family)**
- **Who's on call:** Property managers, maintenance staff, security, leasing agents (emergency line)
- **Typical incidents:** Tenant emergencies (lockouts, plumbing, HVAC), fire alarms, security breaches, elevator outages
- **Current tools:** Yardi/AppFolio (property mgmt), email, shared calendars, personal cell phones

### 8. **Data Center & Colocation Facilities**
- **Who's on call:** NOC engineers, facilities staff, security, customer success (for colo customers)
- **Typical incidents:** Server failures, cooling/power issues, physical security breaches, network outages
- **Current tools:** Monitoring tools (Nagios, Datadog), ticketing (ServiceNow), Slack, PagerDuty (some overlap with SRE)

### 9. **Healthcare On-Call Physician Coverage (Hospitals, Clinics)**
- **Who's on call:** Attending physicians, residents, specialists (cardiology, radiology, surgery), hospitalists
- **Typical incidents:** Inpatient emergencies, consult requests, lab/imaging urgent reviews, admission decisions
- **Current tools:** Hospital paging systems, answering services, personal cell phones, Epic In Basket (messaging)

### 10. **Airport Operations & Ground Handling**
- **Who's on call:** Airport ops managers, ground crew supervisors, TSA coordinators, airline ramp agents
- **Typical incidents:** Gate conflicts, mechanical delays, weather diversions, security incidents, medical emergencies
- **Current tools:** Airport operational databases (AODB), radio, email, Excel for staffing

### 11. **Broadcast & Live Media Operations (TV, Radio, Streaming)**
- **Who's on call:** Master control operators, transmission engineers, producers, IT support
- **Typical incidents:** Signal loss, equipment failures, content delivery errors, breaking news response
- **Current tools:** Broadcast automation software, Slack, phone escalations, runbooks in wiki/PDFs

### 12. **Retail Loss Prevention & Store Security**
- **Who's on call:** Loss prevention officers, store managers, regional security teams
- **Typical incidents:** Shoplifting, employee theft, vandalism, safety hazards, cash handling issues
- **Current tools:** Video surveillance systems, incident reporting apps (Case IQ), email, regional manager escalations

### 13. **Construction Site Safety & Project Management**
- **Who's on call:** Site superintendents, safety officers, subcontractor leads, project managers
- **Typical incidents:** Injuries, OSHA violations, equipment malfunctions, weather delays, safety shutdowns
- **Current tools:** Paper logs, Procore/Autodesk Construction Cloud (project mgmt), SMS, walkie-talkies

### 14. **Transportation & Transit Operations (Bus, Rail, Ferry)**
- **Who's on call:** Dispatchers, operations supervisors, maintenance crews, safety officers
- **Typical incidents:** Vehicle breakdowns, service delays, passenger medical emergencies, accidents
- **Current tools:** CAD/AVL systems (transit-specific), radio, Excel shift schedules, paper logs

### 15. **Facilities Management (Corporate, Government Buildings)**
- **Who's on call:** Facility managers, HVAC techs, electricians, janitorial supervisors, security
- **Typical incidents:** HVAC failures, plumbing emergencies, power outages, elevator issues, tenant requests
- **Current tools:** CMMS (eMaint, Fiix), email work orders, shared calendars, text messages

---

## C. Shortlist and Scoring (Top 5 Markets)

| Market | Incident Severity & Frequency | Current Tooling Maturity | Pain Level with Current Tools | Need for Real-Time Coordination & Audit | Regulatory/Integration Complexity | Overall Attractiveness (1-10) |
|--------|-------------------------------|--------------------------|-------------------------------|----------------------------------------|----------------------------------|------------------------------|
| **Hospital Rapid Response Teams** | High / High | Legacy | High | High | High (HIPAA, EMR integration) | **9/10** – High urgency, clear ROI, underserved by modern tools |
| **Campus Security & Public Safety** | Med / Med | Mixed | High | High | Low-Med (some compliance, no EMR) | **8/10** – Wedge into larger security market, less regulation than hospitals |
| **Utilities & Critical Infrastructure** | High / Med | Legacy | High | High | Med (NERC/CIP compliance, SCADA integration) | **7/10** – Large TAM, but may require hardware integrations |
| **Hotel & Hospitality Operations** | Med / High | Legacy | Med | Med | Low | **7/10** – High volume, fast sales cycles, simpler compliance |
| **Healthcare On-Call Physician Coverage** | High / High | Legacy | High | Med | High (HIPAA, EMR integration) | **8/10** – Premium pricing potential, clear pain, but complex stakeholders |

**Why these 5?**

1. **Hospital Rapid Response Teams:** Life-or-death urgency, frequent incidents (every hospital has codes daily), stuck with 1980s paging tech, desperate for modern coordination. Claude Code shines for adaptive protocols and documentation.

2. **Campus Security:** Large addressable market (thousands of universities + corporate campuses), lower regulatory burden than healthcare, clear upgrade from radios + spreadsheets. We can win early pilots.

3. **Utilities:** Mission-critical incidents (power outages affect millions), legacy systems, high willingness to pay for reliability. Integration complexity is manageable if we focus on coordination layer (not replacing SCADA).

4. **Hospitality:** High incident volume, fast decision cycles, property managers are budget-conscious but pain is real. Good testbed for SMB expansion.

5. **Healthcare On-Call:** Physicians hate pagers and answering services; hospitals pay well for tools that reduce burnout and improve handoffs. Overlap with rapid response teams means we can bundle.

---

## D. Deep Dive per Shortlisted Market

### **1. Hospital Rapid Response Teams (Code Blue, Stroke, Sepsis Alerts)**

#### **Key Personas**

| Role | What "on call" means | What "incident" means |
|------|---------------------|----------------------|
| **Code Team Physician** | Carry code pager 24/7, respond to cardiac arrests within 2-3 minutes | Code Blue (cardiac arrest), Code Stroke, Code STEMI |
| **Rapid Response Nurse** | Shift-based on-call for deteriorating patients before they code | RRT calls for unstable vitals, confusion, respiratory distress |
| **Respiratory Therapist** | On-call for airway emergencies, vent issues | Code Blue backup, intubations, vent alarms |
| **Charge Nurse / Supervisor** | Oversee multiple codes, assign backup staff | Multi-code situations, resource allocation |
| **Quality/Risk Manager** | Review code documentation for compliance, improvement | Post-code audits, Joint Commission reviews |

#### **Current Incident Workflow (Without OnCallShift)**

1. **Alerting:** Overhead PA system ("Code Blue, ICU Room 5") + individual pagers buzz everyone on the team
2. **Response:** Team members physically run to location; no confirmation of who's coming
3. **Coordination:** In-room chaos—who's leading? Who's documenting? Often decided verbally
4. **Documentation:** One nurse scribbles notes on paper during the code; later transcribed into EMR (Epic, Cerner) as a generic "Code Blue Summary" note
5. **Handoff:** If shift changes during or after code, verbal handoff or hope next shift reads the EMR note
6. **Review:** Quality team manually pulls EMR notes weeks later; no timeline, no structured data

**Pain Points:**
- **No confirmation loop:** Can't tell who's responding until they arrive (delays care)
- **Documentation burden:** Nurse must write while also doing CPR/meds—error-prone, incomplete
- **Fragmented context:** Labs, vitals, prior history scattered across EMR tabs
- **Post-code fog:** "What happened?" requires detective work through multiple systems
- **No learning loop:** Patterns (e.g., codes always on night shift, specific units) buried in data
- **Compliance risk:** Joint Commission requires detailed code documentation; missing timelines = citations

#### **How OnCallShift (Current Features) Could Help**

**Direct Fits:**
- **On-call scheduling:** Define code team rotations (primary/backup physician, RT, pharmacist) with automatic handoffs
- **Escalation policies:** If primary doesn't acknowledge in 30 seconds, page backup + charge nurse
- **Incident timeline:** Auto-capture who was paged, who acknowledged, who arrived (via mobile app tap)
- **Mobile app:** Code team members acknowledge, see location, view patient context (if integrated), mark "on scene"
- **Post-incident review:** Structured timeline for quality reviews (MTTA, MTTR, who responded)

**Needed Adaptations:**
1. **Location-based alerting:** "Code Blue, ICU Room 5" needs to parse location and show map/floor plan in app
2. **EMR integration:** Pull basic patient context (age, allergies, recent vitals) into incident view (FHIR API)
3. **Role-specific views:** Charge nurse sees all active codes hospital-wide; code team sees only theirs

**Hard Blockers:**
- **HIPAA compliance:** Must be BAA-signed, encrypted, audit-logged (we already have this foundation)
- **EMR integration complexity:** Epic/Cerner integrations are hard but doable via FHIR; some hospitals won't allow
- **Change management:** Hospitals are slow to adopt; need C-suite buy-in and IT approval (6-12 month sales cycles)

#### **Claude Code Integration: Specific Benefits**

| Benefit | Persona | Problem Solved | Difficulty |
|---------|---------|----------------|-----------|
| **1. Smart Triage & Pre-Code Alerts** | Charge Nurse | Claude Code analyzes real-time vitals from EMR (via FHIR) and flags patients likely to code soon (e.g., trending hypotension + tachycardia). Suggests preemptive RRT call. | **Med** – Requires EMR integration + ML model training on historical code data. But feasible with FHIR APIs. |
| **2. Auto-Generated Code Documentation** | Code Team Nurse | During code, nurse speaks into mobile app ("epi given at 10:32, pulse check negative"). Claude Code generates structured timeline + Epic-compatible note in real time. | **Med** – Speech-to-text + medical terminology NLP. Needs Epic note template mapping. |
| **3. Adaptive Code Protocols** | Code Team Physician | Instead of static ACLS algorithms, Claude Code suggests next steps based on patient-specific factors ("this patient is on beta-blockers, consider calcium for bradycardia"). | **High** – Requires deep medical knowledge base + liability concerns. Start with suggestions, not directives. |
| **4. Handoff Briefs for Shift Change** | Incoming Shift Physician | If code happens near shift change, Claude Code auto-generates a structured SBAR handoff (Situation, Background, Assessment, Recommendation) from incident timeline. | **Low** – Pure summarization from timeline data. Physicians love SBAR. |
| **5. Pattern Detection for Quality Improvement** | Quality/Risk Manager | Claude Code analyzes 6 months of code data, surfaces: "Codes in Unit 3B are 40% more likely to occur during night shift; consider staffing adjustment." | **Med** – Requires aggregated analytics + statistical analysis. High value for hospital C-suite. |
| **6. Natural Language Workflow Customization** | Charge Nurse / IT Admin | Charge nurse says: "For stroke codes, page neurology resident immediately, and notify radiology to prepare CT scanner." Claude Code translates to escalation rule—no IT ticket needed. | **Low-Med** – Natural language → rule engine logic. We already have escalation logic; Claude Code just makes it accessible to non-technical users. |

---

### **2. Campus Security & Public Safety (Universities, Corporate Campuses)**

#### **Key Personas**

| Role | What "on call" means | What "incident" means |
|------|---------------------|----------------------|
| **Patrol Officer** | Shift-based (8-hour shifts), respond to calls campus-wide | Medical emergencies, thefts, suspicious persons, building alarms |
| **Dispatcher** | 24/7 watch commander, coordinates all officers, liaises with city police/fire | Any call to campus safety hotline or alarm trigger |
| **EHS Coordinator** | On-call for hazmat, lab accidents, workplace injuries | Chemical spills, fire alarms, OSHA-reportable incidents |
| **Facilities On-Call** | After-hours building issues (locks, HVAC, leaks) | Lockouts, flooding, power outages, elevator entrapments |
| **Director of Security** | Oversees major incidents, interfaces with university leadership | Active threats, major crimes, Title IX incidents, crisis comms |

#### **Current Incident Workflow**

1. **Alerting:** Call to campus safety dispatch (phone) or physical security system alarm (Genetec, Milestone)
2. **Dispatch:** Dispatcher radios nearest officer, logs incident in spreadsheet or basic CAD system
3. **Response:** Officer radios arrival, provides updates verbally; dispatcher writes notes
4. **Coordination:** Multi-agency incidents (e.g., fire + EMS) coordinated via phone/radio with city services
5. **Documentation:** Officer writes report in Word/PDF after incident; emailed to supervisor
6. **Review:** Director reviews reports manually; compliance (Clery Act reporting for universities) compiled in Excel

**Pain Points:**
- **Radio-only coordination:** No shared incident view; incoming shift has zero context
- **Fragmented systems:** Physical security cameras separate from incident logs separate from building access logs
- **Compliance burden:** Universities must report Clery Act crimes; manual aggregation from officer reports
- **No escalation paths:** "Who do I call for a gas leak at 2 AM?" lives in someone's head
- **Lost tribal knowledge:** When senior officers retire, institutional knowledge of procedures disappears

#### **How OnCallShift Could Help**

**Direct Fits:**
- **On-call scheduling:** Define shifts for patrol, EHS, facilities, with clear escalation (officer → supervisor → director)
- **Incident timeline:** Replace radio logs with structured, searchable timelines (who responded, when, what happened)
- **Mobile app:** Officers acknowledge calls, update status ("on scene," "resolved"), attach photos (broken lock, spill, etc.)
- **Escalation policies:** Auto-escalate to city police if campus officer doesn't acknowledge within 5 minutes
- **Post-incident review:** Generate Clery Act reports from structured incident data

**Needed Adaptations:**
1. **Integration with physical security systems:** Ingest alarms from Genetec/Milestone (door propped, camera motion) as incidents
2. **Location-based dispatch:** Show officer locations on campus map (via mobile app GPS), dispatch nearest available
3. **External agency coordination:** Share incident updates with city police/fire via secure link or API

**Hard Blockers:**
- **Minimal** – No HIPAA, simpler compliance (Clery Act is data reporting, not real-time). Main challenge is integration with legacy security systems (often proprietary).

#### **Claude Code Integration: Specific Benefits**

| Benefit | Persona | Problem Solved | Difficulty |
|---------|---------|----------------|-----------|
| **1. Intelligent Dispatch Suggestions** | Dispatcher | Claude Code analyzes incident type + officer locations/skills. "Chemical spill in Lab Building" → suggests EHS-certified officer, not general patrol. | **Low-Med** – Rule-based logic + officer skill tagging. Easy quick win. |
| **2. Auto-Generated Clery Act Reports** | Director of Security | At month-end, Claude Code extracts all reportable crimes (burglary, assault, hate crimes) from incident timelines, generates formatted Clery report. | **Low** – Incident categorization + report templating. Huge time saver for compliance. |
| **3. Shift Briefing Summaries** | Incoming Patrol Officer | Claude Code generates: "Your shift: 3 open incidents (lockout in Building A, suspicious person near parking lot C). 2 resolved last shift. Weather alert: snow forecast." | **Low** – Timeline summarization + weather API integration. Reduces shift handoff time from 15 min to 2 min. |
| **4. Incident Pattern Analysis** | Director of Security | "Thefts in Library increase 3x during finals week. Recommend extra patrols." Or: "Fire alarms in Dorm B triggered 5x this month—investigate faulty sensor." | **Med** – Time-series analysis + correlation detection. High strategic value. |
| **5. Dynamic Playbook Updates** | EHS Coordinator | EHS says: "For chemical spills in Chemistry labs, add step: notify Environmental Services for cleanup." Claude Code updates the playbook instantly—no IT ticket. | **Low** – Natural language → playbook step insertion. Empowers non-technical admins. |
| **6. Multi-Agency Handoff Summaries** | Dispatcher | When city fire department arrives, Claude Code generates a concise summary: "Building alarm, Room 302, occupants evacuated, no smoke visible, FD requested at 14:22." Share via SMS or secure link. | **Low-Med** – Timeline summarization + external sharing. Reduces miscommunication during handoffs. |

---

### **3. Utilities & Critical Infrastructure (Electric, Water, Gas, Telecom)**

#### **Key Personas**

| Role | What "on call" means | What "incident" means |
|------|---------------------|----------------------|
| **Grid Operator (Electric)** | 24/7 control room shifts, monitor SCADA for grid anomalies | Transformer failures, substation outages, load imbalances |
| **Field Service Technician** | On-call rotation for outages, equipment failures | Power line down, water main break, gas leak, fiber cut |
| **Emergency Response Manager** | On-call for major incidents (storms, mass outages) | Hurricane prep, wildfire grid shutdowns, cyber incidents |
| **Engineering Support** | Technical escalation for complex failures | Root cause analysis, equipment diagnostics, grid restoration plans |
| **Regulatory Compliance Officer** | Review incident reports for NERC CIP, EPA, PUC compliance | Outages affecting >X customers, environmental spills, safety violations |

#### **Current Incident Workflow**

1. **Detection:** SCADA system detects fault (e.g., breaker trip); alarms in control room
2. **Alerting:** Grid operator calls on-call field tech via phone tree (sometimes automated via IVR)
3. **Dispatch:** Field tech drives to site, radios back with status ("tree on line, need bucket truck")
4. **Coordination:** Operator coordinates with multiple techs, dispatch trucks, sometimes mutual aid from neighboring utilities
5. **Documentation:** Operator logs events in outage management system (OMS); field tech writes report in Maximo/SAP
6. **Compliance:** Compliance officer manually extracts data from OMS for NERC CIP or state PUC reports

**Pain Points:**
- **Fragmented systems:** SCADA (monitoring) ≠ OMS (outages) ≠ Maximo (work orders) ≠ phone tree (on-call)
- **Slow escalation:** Phone trees fail when primary tech doesn't answer; no auto-backup
- **Poor handoff during storms:** Multi-day storm response involves 12-hour shifts; handoffs are verbal chaos
- **Compliance nightmares:** NERC CIP requires audit trails for cybersecurity incidents; data scattered across systems
- **No pattern analysis:** Recurring failures (e.g., same transformer overloads every summer) not flagged

#### **How OnCallShift Could Help**

**Direct Fits:**
- **On-call scheduling:** Define field tech rotations by geography (Northwest region, Southeast region) with automatic escalation
- **Escalation policies:** If primary tech doesn't respond in 10 min (maybe out of cell range), escalate to backup + supervisor
- **Incident timeline:** Log SCADA alarm time, dispatcher contact time, tech arrival time, restoration time—full audit trail
- **Post-incident review:** Generate NERC CIP incident reports from timeline data

**Needed Adaptations:**
1. **SCADA integration:** Ingest alarms from SCADA (e.g., via OPC UA or MQTT) and create incidents automatically
2. **Geographic dispatch:** Route incidents to on-call tech based on outage location + tech's home location
3. **External coordination:** Share incident status with mutual aid utilities or state emergency operations centers

**Hard Blockers:**
- **NERC CIP compliance:** Strict cybersecurity requirements for critical infrastructure. We'd need to be audited (doable but expensive).
- **Legacy system integration:** SCADA vendors (GE, Siemens, Schneider) have proprietary protocols; integration is possible but time-consuming.

#### **Claude Code Integration: Specific Benefits**

| Benefit | Persona | Problem Solved | Difficulty |
|---------|---------|----------------|-----------|
| **1. Intelligent Root Cause Suggestions** | Engineering Support | Claude Code analyzes SCADA logs + weather data + prior incidents. "Transformer T-452 failed 3x in past year during high temps. Likely thermal overload—recommend proactive replacement." | **Med-High** – Requires parsing SCADA logs (varies by vendor), correlating with external data (weather APIs), and domain knowledge of failure modes. But huge value for asset management. |
| **2. Auto-Generated NERC CIP Reports** | Compliance Officer | Claude Code extracts all cybersecurity-related incidents (e.g., unauthorized access attempts, control system anomalies), formats into NERC CIP-compliant report with timeline, affected assets, remediation steps. | **Med** – NERC CIP report templates are standardized; challenge is categorizing incidents correctly. High ROI for compliance teams. |
| **3. Storm Restoration Prioritization** | Emergency Response Manager | During hurricane, Claude Code ranks outages by impact (hospitals > commercial > residential), ETR (estimated time to restore), and crew availability. Suggests optimal dispatch sequence. | **Med** – Requires outage impact data (customer counts, critical infrastructure flags) + crew location/skill data. Utilities already track this—we'd aggregate and optimize. |
| **4. Field Tech Handoff Briefs** | Field Service Technician | After 12-hour shift, Claude Code generates: "3 active outages: Main St (crew on-site, ETA 2 hrs), Oak Ave (waiting for parts), Elm St (tree removal needed, contacted contractor)." Incoming shift sees full context instantly. | **Low** – Timeline summarization. Reduces handoff from 30 min to 5 min during storms. |
| **5. Natural Language Work Order Creation** | Grid Operator | Operator says: "Create work order for tree trimming on Circuit 5, priority high, assign to West Region crew." Claude Code generates Maximo work order—no manual data entry. | **Med** – Requires Maximo API integration + NLP to parse intent. But operators hate Maximo's 1990s UI—huge UX win. |
| **6. Predictive Incident Alerts** | Grid Operator | Claude Code monitors SCADA trends (e.g., rising transformer temps, voltage sags) and alerts before failure: "Transformer T-789 temp 15% above normal—recommend inspection within 24 hrs." | **High** – Requires predictive analytics on SCADA time-series data. But utilities would pay premium for this (prevents outages). |

---

### **4. Hotel & Hospitality Operations**

#### **Key Personas**

| Role | What "on call" means | What "incident" means |
|------|---------------------|----------------------|
| **Front Desk Agent** | Shift-based (3 shifts: morning, evening, overnight), first point of contact | Guest complaints, check-in issues, noise complaints |
| **Engineering/Maintenance** | On-call rotation for equipment failures, emergencies | HVAC failures, elevator breakdowns, plumbing leaks, fire alarms |
| **Housekeeping Supervisor** | On-call for urgent room issues (spills, damages) | Room not ready for VIP arrival, bed bugs, guest illness in room |
| **Duty Manager** | On-call supervisor (evening/overnight), handles escalations | Guest medical emergencies, security incidents, VIP requests, event issues |
| **General Manager** | Final escalation for major incidents (rare) | Fires, floods, PR crises, major guest injuries |

#### **Current Incident Workflow**

1. **Alerting:** Guest calls front desk or uses app; fire alarm triggers at front desk panel
2. **Dispatch:** Front desk agent calls engineering on personal cell phone or radios them
3. **Response:** Engineer responds, fixes issue, verbally reports back to front desk
4. **Documentation:** Front desk logs issue in property management system (Opera, Maestro) or paper logbook
5. **Escalation:** If unresolved, front desk calls duty manager; manager decides if GM needs to know
6. **Review:** GM reviews incidents weekly in PMS reports; no structured analysis

**Pain Points:**
- **Lost incidents:** Busy night shift forgets to log issues; no accountability
- **Slow response:** "Where's the engineer? Did they get the call?" Unknown until they show up
- **Guest frustration:** "We called 30 minutes ago, nothing happened"—no visibility into response status
- **Repeat failures:** Same room's AC breaks monthly—pattern not flagged
- **Inefficient staffing:** No data on peak incident times to optimize on-call coverage

#### **How OnCallShift Could Help**

**Direct Fits:**
- **On-call scheduling:** Define engineering, housekeeping, duty manager rotations with clear handoffs
- **Escalation policies:** If engineer doesn't acknowledge room issue in 10 min, escalate to duty manager
- **Mobile app:** Engineer acknowledges call, updates status ("on my way," "resolved"), attaches photo of repair
- **Incident timeline:** Track response time (guest call → engineer arrival → resolution) for service metrics
- **Post-incident review:** Identify repeat failures (Room 305's AC), peak incident times (Friday nights)

**Needed Adaptations:**
1. **PMS integration:** Create incidents from guest service requests in Opera/Maestro (via API)
2. **Guest-facing status:** Optional: Let guest see "Engineer dispatched, ETA 5 minutes" in hotel app
3. **Multi-property support:** Hotel chains need to see incidents across 10-50 properties in one dashboard

**Hard Blockers:**
- **Minimal** – No complex compliance, simpler than healthcare. Main challenge is PMS integration (varies by system).

#### **Claude Code Integration: Specific Benefits**

| Benefit | Persona | Problem Solved | Difficulty |
|---------|---------|----------------|-----------|
| **1. Smart Triage & Prioritization** | Front Desk Agent | Claude Code analyzes guest request: "Room 503 AC not working" + guest profile (VIP, loyalty status, checkout tomorrow). Suggests priority: "High—VIP guest, upgrade or immediate repair." | **Low** – Rule-based logic + guest profile data from PMS. Easy integration. |
| **2. Auto-Generated Shift Handoff Notes** | Duty Manager | At end of shift, Claude Code generates: "Tonight: 2 HVAC calls (both resolved), 1 noise complaint (guests moved), 1 fire alarm (false, kitchen smoke). Follow-up: Room 305 AC needs full inspection." | **Low** – Timeline summarization. Reduces handoff time from 15 min to 2 min. |
| **3. Predictive Maintenance Alerts** | Engineering Manager | Claude Code tracks: "Room 305 AC has been repaired 5x in past 3 months. Recommend full system replacement before summer season." | **Low-Med** – Pattern detection on incident history. High ROI for hotel chains (proactive maintenance cheaper than guest complaints). |
| **4. Guest Satisfaction Impact Analysis** | General Manager | Claude Code correlates incident response times with guest reviews: "Rooms with <10 min engineering response have 4.5-star reviews; >30 min response = 3.2 stars. Current avg: 22 min." | **Med** – Requires integration with review platforms (TripAdvisor, Google) + incident data. But powerful for GM dashboards. |
| **5. Natural Language Incident Logging** | Front Desk Agent | Front desk says: "Guest in 402 reports leaky faucet, non-urgent." Claude Code creates incident, assigns to on-call plumber, sends push notification—no PMS data entry. | **Low** – Voice/text input → incident creation. Reduces friction for busy front desk during check-in rush. |
| **6. Dynamic Playbook for Events** | Duty Manager | Duty manager says: "For wedding events, assign dedicated engineer on-site, have backup HVAC tech on standby, notify GM of any issues immediately." Claude Code encodes this as a reusable event playbook. | **Low** – Natural language → playbook template. Empowers non-technical managers to standardize procedures. |

---

### **5. Healthcare On-Call Physician Coverage**

#### **Key Personas**

| Role | What "on call" means | What "incident" means |
|------|---------------------|----------------------|
| **Hospitalist (Inpatient)** | 24-hour shifts or overnight coverage, manage all admitted patients | New admissions, patient deterioration, floor emergencies |
| **Specialty On-Call (Cardiology, Radiology, Surgery)** | Home call or in-house call, respond to consults | Urgent consults (chest pain, stroke imaging, appendicitis), OR calls |
| **Resident/Fellow** | First-line overnight coverage, escalate to attending | All patient issues, triage which need attending input |
| **Chief Resident / On-Call Coordinator** | Manage resident schedules, handle escalations | Resident sick calls, coverage gaps, complex cases |
| **Office Staff (Clinics)** | After-hours answering service routes calls | Patient prescription refills, urgent questions, triage to ER |

#### **Current Incident Workflow**

1. **Alerting:** Hospital operator pages physician (numeric pager!), answering service calls physician's cell, or EMR In Basket message
2. **Response:** Physician calls back, gets details, decides action (admit, discharge, consult another specialty)
3. **Coordination:** If escalation needed, physician manually calls attending or another specialty
4. **Documentation:** Physician writes note in EMR (Epic, Cerner) after seeing patient—often hours later
5. **Handoff:** Morning handoff is verbal or written list ("sign-out"); no structured timeline
6. **Review:** No systematic review of on-call workload, response times, or outcomes

**Pain Points:**
- **Pagers are awful:** 1980s tech, can't convey context ("call 5823" = mystery until you call back)
- **Call-back delays:** Physician in middle of procedure, doesn't see page for 20 min
- **Handoff disasters:** Verbal sign-out misses critical details; patients "fall through cracks"
- **No workload visibility:** Residents covering 30+ patients overnight with no backup—burnout central
- **Compliance gaps:** Teaching hospitals must log resident duty hours (ACGME); currently manual spreadsheets
- **Answering service inefficiency:** Office on-call physicians waste time on non-urgent calls that could be triaged

#### **How OnCallShift Could Help**

**Direct Fits:**
- **On-call scheduling:** Define specialty rotations (cardiology weekdays, weekends, backup) with ACGME-compliant duty hour tracking
- **Escalation policies:** If resident doesn't respond in 15 min, escalate to attending; if no response in 30 min, escalate to chief
- **Mobile app:** Physician sees page context ("Pt in Room 5, new chest pain, EKG attached"), acknowledges, updates status
- **Incident timeline:** Track consult request time, physician response time, patient outcome—for QI and ACGME compliance
- **Post-shift review:** Generate structured sign-out for incoming physician

**Needed Adaptations:**
1. **EMR integration:** Pull patient context (vitals, recent labs, diagnosis) into incident view via FHIR
2. **ACGME duty hour tracking:** Auto-log hours worked per incident, flag when residents approach 80-hour weekly limit
3. **Answering service integration:** Replace or augment answering services with app-based triage (patients text, AI triages urgency)

**Hard Blockers:**
- **HIPAA compliance:** Same as hospital rapid response—manageable with BAA + encryption
- **Physician adoption resistance:** Physicians hate new tools; must be dramatically better than pagers to overcome inertia
- **EMR integration complexity:** FHIR APIs available, but hospital IT departments are gatekeepers (6-12 month approval cycles)

#### **Claude Code Integration: Specific Benefits**

| Benefit | Persona | Problem Solved | Difficulty |
|---------|---------|----------------|-----------|
| **1. Intelligent Call Triage (Answering Service Replacement)** | Office On-Call Physician | Patient calls after-hours: "I have a headache, should I go to ER?" Claude Code asks clarifying questions (severity, duration, red flags), triages: "Non-urgent, schedule office visit Monday" or "Urgent, recommend ER now." Logs interaction, notifies physician only if truly urgent. | **Med** – Medical triage logic + liability concerns. Start with low-risk specialties (dermatology, orthopedics), not emergency-prone ones (cardiology). But huge time saver for physicians. |
| **2. Auto-Generated Sign-Out Lists** | Resident / Hospitalist | At end of shift, Claude Code generates structured sign-out: "Pt in Room 5: 65M, chest pain, ruled out MI, d/c in AM. Pt in Room 8: 82F, sepsis, pending blood cultures, recheck lactate at 6 AM." Includes action items, pending labs, anticipated issues. | **Low-Med** – Timeline + EMR data aggregation. Gold standard for handoffs (reduces medical errors). |
| **3. ACGME Duty Hour Compliance Tracking** | Chief Resident / GME Office | Claude Code auto-logs resident duty hours from incident timestamps, flags: "Dr. Smith worked 78 hours this week—approaching ACGME limit. Recommend backup coverage for Saturday call." | **Low** – Time tracking from incident data. Residency programs desperate for automated ACGME compliance. |
| **4. Consult Pattern Analysis** | Department Chair / Quality Officer | Claude Code analyzes 6 months of consult data: "Cardiology consults increase 40% on weekends vs weekdays. Recommend adding weekend hospitalist with cardio training." Or: "50% of radiology night calls are 'wet reads' that can wait until morning—adjust expectations." | **Med** – Aggregate analytics + statistical insights. High value for departmental resource planning. |
| **5. EMR Note Drafting from Incident Timeline** | Hospitalist / Specialist | Physician speaks into app during consult: "Saw patient for chest pain, EKG normal, troponin negative, discharge with cardiology follow-up." Claude Code generates Epic-compatible note in SOAP format. | **Med-High** – Medical NLP + EMR note template mapping. Huge time saver (physicians spend 2+ hours/day on documentation). |
| **6. Natural Language On-Call Rule Definition** | Chief Resident | Chief says: "For GI bleeds, page GI fellow immediately. For stable abdominal pain, resident handles first, escalate to attending if no improvement in 2 hours." Claude Code encodes as escalation rules—no IT ticket needed. | **Low** – Natural language → rule engine logic. Empowers medical leaders to customize workflows without IT dependency. |

---

## E. Underserved / Gap Analysis

### **Where Are the Best "Wedge" Opportunities?**

Across all five shortlisted markets, the most underserved niches are:

1. **Mid-Sized Hospitals (100-300 beds) – Rapid Response Teams**
   **Why underserved:** Large academic medical centers (500+ beds) can afford enterprise tools or custom dev. Small critical access hospitals (<50 beds) don't have formal code teams. But 100-300 bed community hospitals have the pain (daily codes), limited budgets, and IT staff who can't build custom solutions. They're stuck with pagers and overhead PA systems.
   **Wedge:** Offer a turnkey rapid response platform at $50-100/user/month (vs. $10K+ for enterprise EMR add-ons). Lead with "Replace your pagers in 30 days." Partner with regional hospital networks (e.g., Tenet, HCA smaller facilities).

2. **University Campuses (5,000-20,000 Students)**
   **Why underserved:** Large universities (30K+ students) have dedicated public safety departments with CAD systems. Small colleges (<2,000 students) outsource security. Mid-sized universities have 5-10 officers, radios, spreadsheets, and no budget for enterprise security software.
   **Wedge:** Sell to university risk managers focused on Clery Act compliance. Lead with "Automated Clery reporting" + "Mobile app for officers" at $2-5K/year. Pilot at 1-2 campuses, win regional conferences (e.g., IACLEA – campus police association).

3. **Municipal Electric/Water Utilities (Serving <100K Customers)**
   **Why underserved:** Large investor-owned utilities (serving millions) have budgets for SCADA + OMS integration. Tiny rural co-ops (serving <5K) have 2-3 employees and basic tools. But municipal utilities (50K-100K customers) have 10-20 field techs, on-call rotations, compliance headaches, and no integrated incident platform.
   **Wedge:** Sell to utility managers at APPA (American Public Power Association) conferences. Lead with "NERC CIP compliance made easy" + "Reduce outage response time by 20%." Offer at $500-1,500/month (fits municipal budgets). Partner with SCADA vendors (GE, Schneider) as resellers.

4. **Boutique/Independent Hotels (50-200 Rooms)**
   **Why underserved:** Large chains (Marriott, Hilton) have enterprise PMS and corporate support. Budget motels have minimal operations. But boutique/independent hotels (often family-owned) compete on service quality, have 5-10 staff on-call, and cobble together tools (spreadsheets, WhatsApp, paper logs).
   **Wedge:** Sell to hotel GMs or owners directly via hospitality industry groups (AH&LA, local hotel associations). Lead with "Improve TripAdvisor scores by faster guest issue resolution." Offer at $200-500/month. Upsell to small chains (10-30 properties) for multi-property dashboards.

5. **Teaching Hospitals – Resident On-Call Coordination**
   **Why underserved:** Large academic medical centers have complex on-call systems, but resident coverage coordination is still manual (spreadsheets, WhatsApp groups). GME (Graduate Medical Education) offices track duty hours in clunky homegrown tools or Excel.
   **Wedge:** Sell to GME offices and program directors at ACGME annual meetings. Lead with "ACGME duty hour compliance automation" + "Reduce resident burnout with smarter scheduling." Offer at $10-20/resident/month. Start with one residency program (e.g., internal medicine), expand to hospital-wide.

6. **Corporate Campus Security (Tech, Pharma, Finance Companies)**
   **Why underserved:** Enterprise security platforms (Genetec, Lenel) focus on physical access control (cameras, badges), not incident coordination. Corporate campuses with 1,000-10,000 employees have 5-20 security officers, fragmented tools, and no good way to coordinate emergencies (medical, weather, active threats).
   **Wedge:** Sell to corporate security directors or facilities VPs. Lead with "Unified incident response for medical emergencies, building alarms, and weather events." Offer at $1-3K/month. Target Fortune 1000 companies with multi-site campuses.

7. **Regional Telecom Providers (Fiber, Cable, Fixed Wireless)**
   **Why underserved:** National ISPs (Comcast, AT&T) have enterprise NOCs and OMS. But regional fiber providers (serving 10K-100K subscribers) have 10-50 field techs, on-call rotations, and no good incident platform beyond email and phone trees.
   **Wedge:** Sell to NOC managers and field ops directors. Lead with "Reduce fiber cut response time" + "Improve customer SLA compliance." Offer at $500-2,000/month. Attend NTCA (telecom association) conferences. Partner with fiber management software vendors (GIS, OSP design tools) as resellers.

### **Common Themes Across Wedge Opportunities**

- **Size sweet spot:** 10-50 people on-call, budgets of $10K-100K/year for tools (not $1M, not $1K)
- **Tool fatigue:** Tired of cobbling together 5 systems; want one unified platform
- **Compliance drivers:** Clery Act, ACGME, NERC CIP, OSHA—regulations create urgency
- **Measurable ROI:** Faster response times, fewer compliance fines, reduced staff burnout
- **Low IT friction:** Can't wait 12 months for IT to build custom solution; want SaaS plug-and-play

---

## F. Recommendations & Next Steps

### **Top 3 Prioritized Markets**

| Rank | Market | Rationale | Initial Offering (MVP Focus) |
|------|--------|-----------|------------------------------|
| **1** | **Hospital Rapid Response Teams (Code Blue, Stroke)** | **Highest urgency, clearest ROI, premium pricing potential.** Life-or-death incidents = high willingness to pay. Pagers are universally hated. Claude Code's medical documentation automation is a killer feature. TAM: ~6,000 U.S. hospitals × 20-50 code team members × $50-100/user/month = $60-300M ARR potential. | **Lead with:** <br>• Pager replacement (mobile app for code alerts)<br>• Incident timeline for quality reviews<br>• Auto-generated code documentation (Claude Code)<br>**Price:** $75/user/month (10-user minimum = $750/month/hospital)<br>**Target:** 100-300 bed community hospitals, rapid response coordinators |
| **2** | **Campus Security & Public Safety (Universities)** | **Lower regulatory burden, faster sales cycles (3-6 months vs. 12+ for hospitals), clear compliance hook (Clery Act).** Universities buy software faster than hospitals. TAM: ~4,000 U.S. universities × 5-20 officers × $30-50/user/month = $7-50M ARR. Easier pilot to prove Claude Code value before tackling hospitals. | **Lead with:**<br>• Mobile app for patrol officers (replace radios for logging)<br>• Auto-generated Clery Act reports (Claude Code)<br>• Incident pattern analysis<br>**Price:** $40/user/month or $3-5K/year flat fee for small campuses<br>**Target:** Mid-sized universities (5K-20K students), directors of public safety |
| **3** | **Municipal Utilities (Electric, Water)** | **Mission-critical, high budgets, but complex integrations.** Utilities pay well ($500-2K/month) and have clear pain (NERC CIP compliance, storm response chaos). Challenge: SCADA integration varies by vendor. But if we crack one (e.g., GE or Schneider), we can replicate. TAM: ~2,000 municipal utilities in U.S. × $1K/month avg = $24M ARR. | **Lead with:**<br>• On-call scheduling for field techs<br>• NERC CIP incident reporting (Claude Code)<br>• Storm restoration prioritization<br>**Price:** $1,000-2,000/month (50-200 employees)<br>**Target:** Municipal utilities (50K-100K customers), operations managers |

**Why this order?**

1. **Hospitals first:** Highest impact (saves lives), premium pricing, validates hardest compliance (HIPAA), showcases Claude Code's medical AI capabilities. If we can win hospitals, everything else is easier.

2. **Campus security second:** Faster to close deals, builds revenue while hospital pilots run, proves Claude Code compliance automation in lower-stakes environment. Use campus wins as case studies for hospitals.

3. **Utilities third:** Largest TAM long-term, but requires SCADA integration investment. Tackle after we have cash flow from hospitals/campuses to fund deeper integrations.

---

### **For Each Priority Market: Focused Plan**

#### **1. Hospital Rapid Response Teams**

**Initial Offering (3-6 Month MVP):**
- **Core features:** Mobile app for code alerts (replace pagers), on-call scheduling, incident timeline, escalation policies
- **Claude Code v1:** Auto-generated SBAR handoff summaries from timeline data (easiest, highest perceived value)
- **EMR integration:** Read-only FHIR API to pull basic patient context (age, allergies, recent vitals) into incident view
- **Compliance:** BAA-ready (HIPAA), SOC 2 foundation, audit logs

**2-3 Discovery Questions for Pilot Hospitals:**
1. "How do you currently coordinate code teams? (pagers, overhead PA, other?) What's most frustrating about it?"
2. "What does your quality team need to report for Joint Commission code reviews? How long does it take to compile?"
3. "If we could replace pagers with a mobile app that shows patient context and auto-generates code documentation, what would that be worth to you per month per user?"

**Potential Risks / Gotchas:**
- **EMR integration delays:** Hospital IT committees meet monthly; FHIR API approval can take 6-12 months. **Mitigation:** Start with read-only basic data (no PHI writes), offer manual data entry fallback for early pilots.
- **Physician resistance:** Doctors hate new apps. **Mitigation:** Pilot with nurses first (they're more tech-savvy), show time savings (5 min/code for documentation), then expand to physicians.
- **Liability concerns:** Auto-generated medical notes could create legal risk if wrong. **Mitigation:** Position as "draft suggestions" that clinicians review/edit, not final notes. Add disclaimers + physician approval step.

**90-Day Learning Plan:**
- **Days 1-30 (Interviews):** Talk to 10-15 rapid response nurses, code team physicians, quality managers at community hospitals. Ask: What are top 3 pain points? What tools have you tried? What would make you switch from pagers?
- **Days 31-60 (Prototype):** Build clickable mobile app prototype showing: code alert with patient context, acknowledge button, timeline view, Claude Code-generated handoff summary. Demo to 5 pilot hospitals. Ask: "Would you pilot this for 60 days?"
- **Days 61-90 (Pilot Selection):** Select 1-2 hospitals willing to pilot (ideally one using Epic, one using Cerner for EMR coverage). Define success metrics: response time <3 min, 80% of codes documented in app, quality team saves 2+ hours/week on reports.
- **Signals to proceed:** 2+ hospitals commit to 60-day paid pilot ($500-1K/month); code team members use app for >50% of codes; quality team asks "can we roll this out hospital-wide?"
- **Signals to pause:** Physicians refuse to use app; hospital IT blocks FHIR API access; legal/compliance raises insurmountable concerns.

---

#### **2. Campus Security & Public Safety**

**Initial Offering (2-4 Month MVP):**
- **Core features:** Mobile app for officers (incident logging, photo uploads, status updates), on-call scheduling, incident timeline
- **Claude Code v1:** Auto-generated Clery Act monthly reports (categorize incidents by crime type, generate formatted report)
- **Integration:** Optional integration with physical security systems (Genetec, Milestone) via webhook alerts
- **Compliance:** Basic audit logs, SSL encryption (no HIPAA needed)

**2-3 Discovery Questions for Pilot Campuses:**
1. "How do officers currently log incidents? (radio, paper, Word docs?) How much time does shift handoff take?"
2. "How do you compile Clery Act reports at year-end? How long does it take, and what's the biggest pain?"
3. "If we offered a mobile app that logs incidents and auto-generates Clery reports, what would that be worth? ($3K/year? $5K?)"

**Potential Risks / Gotchas:**
- **Physical security integration complexity:** Genetec, Lenel, Milestone all have different APIs. **Mitigation:** Start with manual incident creation (officer taps "new incident" in app), add alarm integrations later as upsell.
- **Resistance from veteran officers:** "We've used radios for 20 years, why change?" **Mitigation:** Pilot with younger officers or supervisors first; show time savings (10 min/incident for logging); emphasize compliance benefits to director.
- **Budget cycles:** Universities plan budgets 12-18 months ahead. **Mitigation:** Offer free/discounted pilots during current fiscal year, get included in next year's budget.

**90-Day Learning Plan:**
- **Days 1-30:** Interview 10-12 campus security directors, patrol officers, dispatchers. Attend one regional IACLEA (campus police) or ASIS (security professionals) chapter meeting. Ask: What tools do you use? What's missing? What compliance keeps you up at night?
- **Days 31-60:** Build mobile app prototype: incident logging form, timeline view, photo upload, Claude Code Clery report generator. Demo to 3-5 campuses. Ask: "Would you pilot this for a semester?"
- **Days 61-90:** Run pilot at 1-2 universities (ideally one large public, one private). Track: incidents logged in app vs. paper, Clery report generation time (before: 40 hours, after: 2 hours), officer satisfaction.
- **Signals to proceed:** 1-2 campuses commit to paid annual contract ($3-5K); officers log >70% of incidents in app; Clery coordinator says "this saved me weeks of work."
- **Signals to pause:** Officers don't adopt app (<30% usage); directors say "nice but not in budget"; Clery report generator has too many errors (requires heavy manual edits).

---

#### **3. Municipal Utilities (Electric, Water)**

**Initial Offering (4-6 Month MVP):**
- **Core features:** On-call scheduling (by geography), escalation policies, incident timeline, mobile app for field techs
- **Claude Code v1:** Auto-generated NERC CIP incident reports (if electric utility); storm restoration prioritization suggestions
- **Integration:** Webhook ingestion from SCADA alarms (simple HTTP POST); no deep SCADA integration yet
- **Compliance:** Basic encryption, audit logs (NERC CIP foundation)

**2-3 Discovery Questions for Pilot Utilities:**
1. "How do you currently manage on-call rotations for field techs? (phone tree, spreadsheet?) What happens when primary tech doesn't answer?"
2. "For major outages (storms, equipment failures), how do you coordinate field crews and document response for NERC or state regulators?"
3. "If we could give you a mobile app for field techs + auto-generated NERC CIP reports, what would that be worth per month?"

**Potential Risks / Gotchas:**
- **SCADA integration complexity:** Every utility has different SCADA vendor (GE, Siemens, Schneider); deep integration is expensive. **Mitigation:** Start with simple webhook alerts (SCADA → OnCallShift via HTTP POST); offer manual incident creation as fallback.
- **NERC CIP compliance audit:** If we claim NERC CIP compliance, we may need to undergo security audit ($$). **Mitigation:** Position as "NERC CIP report generation tool" (not full compliance platform); utilities keep responsibility for overall compliance.
- **Sales cycle length:** Utilities move slowly (12-18 month procurement cycles). **Mitigation:** Target smaller municipal utilities (faster decisions than investor-owned utilities); attend APPA conferences for direct access to decision-makers.

**90-Day Learning Plan:**
- **Days 1-30:** Interview 8-10 utility operations managers, field service supervisors, compliance officers. Attend APPA conference or regional utility meeting. Ask: What tools do you use for outage management? What's your NERC CIP reporting process? What's broken?
- **Days 31-60:** Build mobile app prototype: outage alert, field tech response, incident timeline, Claude Code NERC CIP report generator. Demo to 3-4 utilities. Ask: "Would you pilot this during next storm season?"
- **Days 61-90:** Run pilot at 1 municipal electric utility (50K-100K customers). Track: field tech response time, incident documentation completeness, NERC CIP report generation time.
- **Signals to proceed:** 1 utility commits to 12-month paid contract ($12-24K/year); field techs use app for >60% of outages; compliance officer says "this simplified our NERC reporting."
- **Signals to pause:** Utility IT blocks cloud SaaS (requires on-prem); SCADA integration is impossible without vendor partnership; compliance officer says "this doesn't meet NERC requirements."

---

### **Cross-Cutting Recommendations**

**Product Priorities (Next 6 Months):**
1. **Claude Code "Report Generator" module:** Auto-generate compliance reports (Clery, NERC CIP, ACGME, Joint Commission) from incident timelines. **Why first:** Easiest to build (summarization + templating), high perceived value, works across all 3 markets.
2. **Mobile app enhancements:** Photo uploads, offline mode (for field techs in poor cell coverage), voice-to-text incident logging. **Why second:** Mobile is critical for field responders (hospital codes, campus officers, utility techs).
3. **Basic EMR/SCADA webhook ingestion:** Accept HTTP POST webhooks with JSON payload to create incidents. **Why third:** Unlocks automation (hospital vitals alerts, SCADA alarms) without deep vendor integrations.

**Sales & Marketing:**
- **Hire domain expert sales rep** for each market (hospital, campus, utility) on commission-only basis initially. Look for former practitioners (ex-hospital quality manager, ex-campus police chief, ex-utility operations manager) who know the pain and have network.
- **Content marketing:** Write case studies + blog posts:
  - "How XYZ Hospital Replaced Pagers and Saved 10 Hours/Week on Code Documentation"
  - "ABC University Automated Clery Act Reporting in 90 Days"
  - "Municipal Utility Cuts Storm Response Time by 25% with OnCallShift"
- **Conference presence:** IACLEA (campus police), APPA (utilities), ACEP (emergency physicians), ACHE (healthcare executives). Booth + speaking slot to demo Claude Code capabilities.

**Team & Hiring:**
- **Healthcare compliance consultant** (contract, $5-10K project): Review HIPAA/BAA requirements, draft templates, advise on EMR integration best practices.
- **Industry advisor board:** Recruit 3-5 advisors (hospital quality director, campus security director, utility ops manager) for quarterly feedback sessions. Compensate with equity (0.1-0.25% each) or cash ($2-5K/year).

**Success Metrics (12 Months):**
- **Pilots:** 5-10 paying pilots across 3 markets (2-3 hospitals, 3-4 campuses, 1-2 utilities)
- **Revenue:** $50-100K ARR from pilots
- **Product-market fit signals:**
  - Net Promoter Score (NPS) >50 from pilot users
  - >3 inbound leads/month from word-of-mouth or case studies
  - 1-2 pilot customers expand to full deployment (e.g., hospital goes from 10-user code team to 50-user hospital-wide)
- **Claude Code validation:** 70%+ of pilot users say Claude Code features (report generation, handoff summaries) are "very valuable" or "essential"

---

## Summary

**OnCallShift + Claude Code is uniquely positioned to disrupt legacy incident coordination in mission-critical industries beyond software/SRE.** The combination of modern mobile-first UX, opinionated workflows, and AI-powered automation addresses pain points that haven't changed in 20-30 years (pagers, radios, spreadsheets, fragmented systems).

**Top 3 markets—hospitals, campuses, utilities—all share:**
- Time-critical incidents where delays cost lives, reputation, or revenue
- Fragmented tooling (5+ systems that don't talk)
- Compliance pressures (HIPAA, Clery, NERC CIP) that create urgency
- Underserved mid-market (10-200 people on-call) with real budgets ($10K-100K/year)

**Claude Code is not just a "nice-to-have"—it's a competitive moat:**
- **Compliance automation** (Clery reports, NERC CIP, ACGME) saves 10-50 hours/month—instant ROI
- **Medical documentation** (code summaries, handoff briefs) reduces physician burnout—premium pricing justified
- **Intelligent triage** (route incidents based on context, not just on-call schedule) improves response times—measurable KPIs

**Recommended path:**
**Start with hospitals (highest urgency, premium pricing) → prove Claude Code medical AI → expand to campuses (faster sales, compliance validation) → tackle utilities (largest TAM, requires deeper integrations).** By Year 2, we could have $1-3M ARR across 50-100 customers in these three markets, positioning us to either (a) dominate incident management for mission-critical industries or (b) become an attractive acquisition target for healthcare IT (Epic, Cerner) or security platforms (Genetec, Everbridge).

**Next immediate action:** Interview 5 hospital rapid response coordinators this month. Ask: "If we could replace your pagers with a mobile app that auto-generates code documentation using AI, what would you pay for that?" Then build the prototype.

---

*Analysis Date: December 2024*
*Document Owner: Product Strategy*
*Review Frequency: Quarterly*
