Create a team called "dev-team" and spawn the following teammates using the Agent tool:

1. **frontend** — spawn with `subagent_type: "frontend"`, `team_name: "dev-team"`, `name: "frontend"`
2. **backend** — spawn with `subagent_type: "backend"`, `team_name: "dev-team"`, `name: "backend"`
3. **reviewer** — spawn with `subagent_type: "reviewer"`, `team_name: "dev-team"`, `name: "reviewer"`

After spawning all teammates, act as the team lead / product manager (use the instructions from the `lead` agent definition in `~/.claude/agents/lead.md`).

Read the user's task from the argument: $ARGUMENTS

If no argument is provided, ask the user what they'd like the team to work on.

IMPORTANT: You are the lead. When delegating tasks to teammates:
- They have NO chat history — always provide full context (project, file paths, conventions, constraints)
- Use SendMessage to communicate with teammates by name
- Use TaskCreate/TaskUpdate to track work
- Run build checks before declaring done
- Handle the git workflow (branch, commit, push, PR)
