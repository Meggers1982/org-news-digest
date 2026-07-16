"""Send the org news digest via Resend."""

import re
import resend


# ---------------------------------------------------------------------------
# Minimal Markdown → HTML converter (no external dependencies)
# ---------------------------------------------------------------------------

def _md_inline(text: str) -> str:
    """Convert inline markdown to HTML."""
    text = re.sub(r"\*\*\*(.+?)\*\*\*", r"<strong><em>\1</em></strong>", text)
    text = re.sub(r"\*\*(.+?)\*\*", r"<strong>\1</strong>", text)
    text = re.sub(r"\*(.+?)\*", r"<em>\1</em>", text)
    text = re.sub(r"`(.+?)`", r"<code style='background:#f4f4f4;padding:1px 4px;border-radius:3px'>\1</code>", text)
    text = re.sub(r"\[([^\]]+)\]\(([^)]+)\)", r'<a href="\2" style="color:#1a6fbd">\1</a>', text)
    return text


def markdown_to_html(md: str) -> str:
    """Convert Markdown to a clean HTML fragment."""
    lines = md.split("\n")
    html: list[str] = []
    in_table = False
    table_header_done = False
    in_code_block = False
    paragraph_lines: list[str] = []

    def flush_paragraph():
        if paragraph_lines:
            content = " ".join(paragraph_lines).strip()
            if content:
                html.append(f"<p style='margin:0 0 10px'>{_md_inline(content)}</p>")
            paragraph_lines.clear()

    for line in lines:
        if line.startswith("```"):
            flush_paragraph()
            if not in_code_block:
                html.append("<pre style='background:#f4f4f4;padding:12px;border-radius:4px;overflow-x:auto;font-size:13px'><code>")
                in_code_block = True
            else:
                html.append("</code></pre>")
                in_code_block = False
            continue

        if in_code_block:
            html.append(line.replace("<", "&lt;").replace(">", "&gt;"))
            continue

        if "|" in line:
            stripped = line.strip()
            if re.match(r"^\|[-| :]+\|$", stripped):
                html.append("</thead><tbody>")
                table_header_done = True
                continue
            if not in_table:
                flush_paragraph()
                html.append("<table style='border-collapse:collapse;width:100%;margin:12px 0;font-size:13px'><thead>")
                in_table = True
                table_header_done = False
            cells = [c.strip() for c in stripped.split("|") if c.strip()]
            tag = "th" if not table_header_done else "td"
            style = (
                "style='border:1px solid #ddd;padding:6px 10px;text-align:left;"
                + ("background:#f0f4f8;font-weight:bold'" if tag == "th" else "'")
            )
            row = "".join(f"<{tag} {style}>{_md_inline(c)}</{tag}>" for c in cells)
            html.append(f"<tr>{row}</tr>")
            continue

        if in_table:
            html.append("</tbody></table>")
            in_table = False
            table_header_done = False

        if re.match(r"^-{3,}$", line.strip()):
            flush_paragraph()
            html.append("<hr style='border:none;border-top:1px solid #e0e0e0;margin:18px 0'>")
            continue

        m = re.match(r"^(#{1,4})\s+(.*)", line)
        if m:
            flush_paragraph()
            level = len(m.group(1))
            sizes = {1: "22px", 2: "18px", 3: "15px", 4: "14px"}
            margins = {1: "24px 0 8px", 2: "20px 0 6px", 3: "14px 0 4px", 4: "10px 0 4px"}
            weights = {1: "700", 2: "700", 3: "600", 4: "600"}
            html.append(
                f"<h{level} style='font-size:{sizes[level]};margin:{margins[level]};"
                f"color:#1a1a2e;font-weight:{weights[level]}'>"
                f"{_md_inline(m.group(2))}</h{level}>"
            )
            continue

        if re.match(r"^[-*]\s+", line):
            flush_paragraph()
            content = re.sub(r"^[-*]\s+", "", line)
            html.append(f"<li style='margin:4px 0;line-height:1.5'>{_md_inline(content)}</li>")
            continue

        if not line.strip():
            flush_paragraph()
            continue

        paragraph_lines.append(line)

    flush_paragraph()
    if in_table:
        html.append("</tbody></table>")
    if in_code_block:
        html.append("</code></pre>")

    return "\n".join(html)


# ---------------------------------------------------------------------------
# Email template
# ---------------------------------------------------------------------------

_EMAIL_TEMPLATE = """\
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>{subject}</title>
</head>
<body style="margin:0;padding:0;background:#f0f2f5;font-family:Arial,Helvetica,sans-serif;color:#222;font-size:14px;line-height:1.6">
<table width="100%" cellpadding="0" cellspacing="0">
<tr><td align="center" style="padding:24px 16px">
<table width="100%" style="max-width:700px;background:#fff;border-radius:6px;
       box-shadow:0 2px 6px rgba(0,0,0,.1);overflow:hidden">

  <!-- Header -->
  <tr><td style="background:#0d2137;padding:24px 32px">
    <p style="margin:0;font-size:10px;color:#6a8aaa;letter-spacing:1.5px;text-transform:uppercase">
      Internal Monitor</p>
    <h1 style="margin:6px 0 0;font-size:20px;color:#fff;line-height:1.3">
      Org News Digest</h1>
    <p style="margin:4px 0 0;font-size:12px;color:#8aaac8">{run_date} &nbsp;·&nbsp; {item_count} items across {source_count} sources</p>
  </td></tr>

  <!-- Body -->
  <tr><td style="padding:28px 32px">
    {digest_html}
  </td></tr>

  <!-- Footer -->
  <tr><td style="background:#f8f9fa;padding:14px 32px;border-top:1px solid #e8eaed">
    <p style="margin:0;font-size:11px;color:#888;line-height:1.5">
      Generated automatically from RSS feeds, PR Newswire, and Business Wire via the Claude API.
      For internal use only.
    </p>
  </td></tr>

</table>
</td></tr>
</table>
</body>
</html>
"""


def send_digest_email(
    to_email: str,
    from_email: str,
    run_date: str,
    item_count: int,
    source_count: int,
    digest_content: str,
    resend_api_key: str,
) -> None:
    """Send the digest via Resend."""
    resend.api_key = resend_api_key

    digest_html = markdown_to_html(digest_content)
    subject = f"Org News Digest — {run_date}"

    html_body = _EMAIL_TEMPLATE.format(
        subject=subject,
        run_date=run_date,
        item_count=item_count,
        source_count=source_count,
        digest_html=digest_html,
    )

    params: resend.Emails.SendParams = {
        "from": from_email,
        "to": [to_email],
        "subject": subject,
        "html": html_body,
    }
    resend.Emails.send(params)
