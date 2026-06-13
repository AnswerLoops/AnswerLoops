<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Build plan hygiene

After completing any phase or significant feature:
1. Mark it `✅` in `docs/BUILD-PLAN.md` and update the files list.
2. Update the "Recommended next order" section.
3. Push the updated `docs/BUILD-PLAN.md` to Notion using the Notion MCP (`mcp__notion__notion-update-page`, page ID `3762539abb6b80309582dba90926769d`).

Do this before opening the PR for that work.
