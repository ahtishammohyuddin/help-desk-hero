"""Planned problem titles for Help Desk Hero, plus the coverage targets.

TITLES[category][level] is the ordered list of titles planned for that cell.
TARGETS[category] is the target count per level (L1..L5) from the project brief.
The coverage report (later step) reuses TARGETS.

Run `python -m tools.problem_titles` to print the list as Markdown.
"""

from __future__ import annotations

from tools.validate_problems import CATEGORIES

# Target counts per level (L1, L2, L3, L4, L5), straight from the brief.
TARGETS: dict[str, tuple[int, int, int, int, int]] = {
    "Hardware": (8, 6, 4, 2, 1),
    "Printers and scanners": (4, 5, 4, 2, 1),
    "Windows and OS": (5, 7, 6, 4, 2),
    "Accounts and passwords": (4, 6, 4, 4, 3),
    "Email and Outlook / M365": (3, 6, 5, 3, 2),
    "Networking and Wi-Fi": (3, 6, 6, 6, 4),
    "Software and installs": (3, 5, 5, 3, 2),
    "Security and phishing": (2, 4, 5, 5, 5),
    "Mobile and phones": (2, 4, 3, 2, 1),
    "Servers, backups, Active Directory": (0, 1, 3, 6, 8),
    "Customer handling": (2, 2, 2, 1, 1),
}

TITLES: dict[str, dict[int, list[str]]] = {
    "Hardware": {
        1: [
            "Keyboard not typing",
            "Mouse pointer frozen",
            "Black screen, PC running",
            "PC will not turn on",
            "Monitor says No Signal",
            "No sound from speakers",
            "Laptop not charging",
            "USB drive not recognised",
        ],
        2: [
            "Laptop overheating and shutting down",
            "Second monitor not detected",
            "Docking station not working",
            "Webcam not found in video calls",
            "Headset microphone not picked up",
            "Beeping sound at startup",
        ],
        3: [
            "Random blue screens, suspect faulty RAM",
            "Slow PC with disk health warnings",
            "Laptop dead after liquid spill",
            "Replace failed SSD and restore the image",
        ],
        4: [
            "Swollen laptop batteries across a department",
            "Same PC model freezing, firmware update needed",
        ],
        5: [
            "Hardware refresh plan for 200 desktops",
        ],
    },
    "Printers and scanners": {
        1: [
            "Printer shows offline",
            "Paper jam",
            "Faint prints, toner low",
            "Document stuck in print queue",
        ],
        2: [
            "Wrong printer set as default",
            "Cannot connect to shared network printer",
            "Streaky lines on printouts",
            "Scan to email not working",
            "Printer prints blank pages",
        ],
        3: [
            "Print spooler keeps stopping",
            "Printer driver conflict after Windows update",
            "Printer lost its IP address",
            "Scan to folder: access denied",
        ],
        4: [
            "Print server migration to a new server",
            "Secure print release failing for one team",
        ],
        5: [
            "Print fleet consolidation and cost control plan",
        ],
    },
    "Windows and OS": {
        1: [
            "PC running slowly",
            "Application not responding, unsaved work",
            "Low disk space warning",
            "Screen resolution looks wrong",
            "Cannot find a saved file",
        ],
        2: [
            "Windows Update stuck",
            "Slow startup from too many startup apps",
            "Signed in with a temporary profile",
            "High CPU from an unknown process",
            "Wrong date and time breaks websites",
            "PDF files open in the wrong app",
            "Not enough space to install updates",
        ],
        3: [
            "Boot loop after an update",
            "Corrupted system files",
            "BitLocker asks for recovery key",
            "Group Policy not applying",
            "New driver causes crashes",
            "Remote Desktop connection fails",
        ],
        4: [
            "Mass Windows deployment with imaging",
            "Patch breaks a business app, rollback needed",
            "Recurring crash found in event logs",
            "Domain trust relationship failed",
        ],
        5: [
            "Design patch rings and a standard build policy",
            "Fleet-wide performance investigation",
        ],
    },
    "Accounts and passwords": {
        1: [
            "Forgot password",
            "Account locked after wrong attempts",
            "New starter needs an account",
            "Password rejected, Caps Lock on",
        ],
        2: [
            "Password expired while working remotely",
            "Request access to a shared mailbox",
            "Lost phone, MFA no longer works",
            "Cannot sign in to one app only",
            "Name change on an account",
            "Access request needs manager approval",
        ],
        3: [
            "Account keeps locking out",
            "Offboarding a leaver",
            "Shared folder permissions wrong",
            "Service account password expired",
        ],
        4: [
            "Onboarding 30 new hires at once",
            "Privileged access audit",
            "Single sign-on failing for one app",
            "Conditional access blocks a travelling user",
        ],
        5: [
            "Design role-based access control",
            "Compromised admin account response",
            "Roll out MFA across the company",
        ],
    },
    "Email and Outlook / M365": {
        1: [
            "Outlook will not open",
            "Mailbox full",
            "Attachment too large to send",
        ],
        2: [
            "Email stuck in the Outbox",
            "Missing meeting invites",
            "Set up an out-of-office reply",
            "Outlook keeps asking for the password",
            "Important email lands in spam",
            "Add a shared mailbox to Outlook",
        ],
        3: [
            "Outlook profile corrupted",
            "Delegate cannot send as manager",
            "No mail from one external sender",
            "Huge mailbox makes Outlook slow",
            "Distribution list not delivering",
        ],
        4: [
            "Mail flow rule blocks legitimate mail",
            "Company mail failing SPF and DKIM checks",
            "Mailbox migration with missing items",
        ],
        5: [
            "Email security hardening plan",
            "Plan a hybrid mail migration",
        ],
    },
    "Networking and Wi-Fi": {
        1: [
            "No internet on one PC",
            "Wi-Fi password rejected",
            "Network cable unplugged message",
        ],
        2: [
            "Slow Wi-Fi in one corner of the office",
            "Cannot reach the shared drive",
            "Websites not loading, DNS suspected",
            "IP address conflict",
            "VPN will not connect from home",
            "Wi-Fi keeps dropping",
        ],
        3: [
            "DHCP not handing out addresses",
            "New desk on the wrong VLAN",
            "Intermittent packet loss",
            "Website blocked by the firewall",
            "Wi-Fi drops when walking between floors",
            "Switch port shut down by port security",
        ],
        4: [
            "Network loop slows the whole office",
            "Internal DNS server failure",
            "Site-to-site VPN down",
            "Rogue DHCP server on the network",
            "VLAN trunk misconfigured",
            "Bandwidth saturated, find the cause",
        ],
        5: [
            "Network design for a new office",
            "Wi-Fi capacity planning",
            "Design internet failover",
            "Major outage response and review",
        ],
    },
    "Software and installs": {
        1: [
            "Application will not open",
            "Request new software through the proper process",
            "Browser slow, clear cache and tabs",
        ],
        2: [
            "Software licence expired",
            "Installer asks for admin rights",
            "Browser extension causing pop-ups",
            "Two versions of an app conflict",
            "Office app crashes opening one file",
        ],
        3: [
            "Remote software deployment fails",
            "App works for one user but not another",
            "Legacy app needs compatibility mode",
            "Build a silent install package",
            "Licence server unreachable",
        ],
        4: [
            "Patch a third-party app across the fleet",
            "Package an app for deployment",
            "Application allowlist blocks a needed app",
        ],
        5: [
            "Software licence audit",
            "Build a self-service app catalogue",
        ],
    },
    "Security and phishing": {
        1: [
            "User offers to share their password",
            "Suspicious email asks to click a link",
        ],
        2: [
            "Unknown USB drive found in the car park",
            "Pop-up claims a virus, call this number",
            "Unlocked PC left unattended",
            "Gift card request from the CEO",
        ],
        3: [
            "Phishing email reported by several users",
            "Ransom note on one PC",
            "Company laptop lost on a trip",
            "Antivirus alert on a user PC",
            "Suspicious sign-in alert",
        ],
        4: [
            "Compromised mailbox sending spam",
            "Email with sensitive data sent to the wrong person",
            "Triage vulnerability scan results",
            "Employee downloading unusually large files",
            "Investigate a phishing campaign",
        ],
        5: [
            "Ransomware outbreak response",
            "Emergency patching of a zero-day flaw",
            "Remediate security audit findings",
            "Incident review and lessons learned",
            "Least-privilege access review",
        ],
    },
    "Mobile and phones": {
        1: [
            "Phone will not charge",
            "Phone cannot join the office Wi-Fi",
        ],
        2: [
            "Work email not syncing on phone",
            "Set up work email on a new phone",
            "Phone storage full",
            "Move the MFA app to a new phone",
        ],
        3: [
            "Lost phone, remote wipe decision",
            "Device enrolment fails",
            "App notifications not arriving",
        ],
        4: [
            "Personal phone policy conflict",
            "Wi-Fi certificate not reaching phones",
        ],
        5: [
            "Plan a mobile device management rollout",
        ],
    },
    "Servers, backups, Active Directory": {
        1: [],
        2: [
            "File server share almost full",
        ],
        3: [
            "Overnight backup job failed",
            "Mapped drive access denied",
            "Server disk space running low",
        ],
        4: [
            "Restore a deleted folder from backup",
            "Active Directory replication warning",
            "DHCP scope exhausted",
            "Server will not boot after patching",
            "Stale DNS records cause wrong connections",
            "File server migration",
        ],
        5: [
            "Domain controller failure",
            "Design a 3-2-1 backup strategy",
            "Run a disaster recovery test",
            "Clean up stale Active Directory accounts",
            "Redesign Group Policy structure",
            "Server capacity planning",
            "Recover from ransomware using backups",
            "Transfer or seize a domain role after failure",
        ],
    },
    "Customer handling": {
        1: [
            "Angry user raising their voice",
            "User does not understand technical terms",
        ],
        2: [
            "User wants an instant fix, queue has priorities",
            "Ticket needs more information from the user",
        ],
        3: [
            "VIP demands to skip the queue",
            "Explain downtime to a non-technical manager",
        ],
        4: [
            "Repeat complaint about the same issue",
        ],
        5: [
            "Announce a major outage to the whole company",
        ],
    },
}


def problem_id(level: int, category: str, number: int) -> str:
    """Build an id like L1-HW-03 (number counts within level and category)."""
    return f"L{level}-{CATEGORIES[category]}-{number:02d}"


def all_entries() -> list[dict]:
    """Flat list of {id, level, category, title}, ordered by level then category."""
    entries = []
    for level in range(1, 6):
        for category in CATEGORIES:
            for number, title in enumerate(TITLES[category][level], start=1):
                entries.append(
                    {
                        "id": problem_id(level, category, number),
                        "level": level,
                        "category": category,
                        "title": title,
                    }
                )
    return entries


def to_markdown() -> str:
    lines = ["# Help Desk Hero: planned problem titles", ""]
    total = len(all_entries())
    lines.append(f"Total: {total} problems. Review each level and tell me what to change.")
    lines.append("")
    for level in range(1, 6):
        count = sum(len(TITLES[c][level]) for c in CATEGORIES)
        lines.append(f"## Level {level} ({count})")
        lines.append("")
        for category in CATEGORIES:
            titles = TITLES[category][level]
            if not titles:
                continue
            lines.append(f"**{category}** ({len(titles)})")
            for number, title in enumerate(titles, start=1):
                lines.append(f"- `{problem_id(level, category, number)}` {title}")
            lines.append("")
    return "\n".join(lines)


if __name__ == "__main__":
    print(to_markdown())
