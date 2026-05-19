This Document outliones the business plan of LEVER AI. Do not write to this file only read. 

Lever AI is a financial planning application used directly by individuals to learn about financial concepts, utilize AI to make a financial plan and explore opportunities found by AI (government programs, tax arbitrage, local market opportunities).

Problem:
Not everyone wants to go to a financial advisor to create a retirement plan or make large financial decisions. They do this 1, because they believe the financial advisor will take advantage of them, 2, that they don't feel like they have enough money to be someone that makes financial plans. 3. They believe they can do better on their own and the internet and AI

The pain is then that there exists no easy to use. The pain is also this plan lays dormant in a excel, or document on the persons computer and has no way to update them to the changing needs of their plan based on changes to the financial world. While enjoying financial 

Solution is to create a tool that people can build a financial plan, set long term goals, run what if situations, explore financial opportunities, run optimization and monte carlo simulations to see best decision, also be recommended financial programs and opportunities to look into. While they are not using the tool the tool will also continue to monitor the market, legislation and changes in relevant programs that are connected to their plan and notify them of changes, opportunities and advisement. This is all done in a sandbox environment that is all for the user to experiment around in without being a true recommendation for a verified financial advisor.

Beach head customer (ideal customer): Male age 21-30 early in his professional career. MAy have a job offer, renting but considering buying, retirement accounts, budgeting goals, starting with a family. Semi techy, diy kinda person that thinks they can build and do things on their own. Would turn to the internet to answer financial questions.

Implementation
In order to be a differentiator on the technology to solve this the main use of this technology will be within a chat interface. Working directly with claude a plan can be made, financial simulations can be run, documents can be uploaded read and summarized for context, goals can be set, and personal preferences can be known (risk tolerance). 

Outside of the chat interface a beautiful and simple dashboards will show them their current and past financial progress and snapshots. THe dashboard should not be difficult to cooperate, make it like claude UX a single nav bar to switch between dashboards with their profile, settings all elegantly placed and accessible. Their current financial plan, what if situation plans, monte carlo simulations, optimization outlooks, cashflow, estimated taxes, accounts, problems with plan, store financial documents (tax forms, bank statements, bills, pay day, loans, mortgage contract, etc) for them where they can add and remove documents (the documents will have AI summaries with them useful for Claude).

Graph displays will be simple but beautiful using the latest and most popular display interfaces 

The onboarding experience will be seamless, where a user quickly makes an account through google, or an email and it creates them an account helps them connect to Claude with visual help along the way, them displays them their plan. Interaction in editing their plan is minimal from the web side for now.

Admin
On an site for the admin/sales rep/developer of the application there will be another app where its in develop mode where the admin can go to any profile and see the app as they see it but with tools in order to update their data easily for live support with a client. None of the data is secure or secret so easy to manipulate as a admin with free access to the database. THe admin page will be where workflows will be done for each person individually or across multiple users and approved before they are pushed out as a mobile notification.

Supabase will be used as the database, RLS will be used for the user side so they can only access their plans

An app will accompany as a simple interface to see a small portion of their financial plan, dashboards will be incredibly simple, notification settings will be displayed and managing account information as well as simple keeping their financial plan up to date. Also can be used for simple adding financial documents, and taking pictures of financial documents The phone will be used to send the user notifications about their financial plan. A separate server will be ran in the background for those notifications to be sent but it will be triggered through the backend (Next JS) for the user

Software stack
A single next JS application will act for both the MCP server which will be a mcp app (https://modelcontextprotocol.io/extensions/apps/overview) endpoints with the help of mcp-handler (https://vercel.com/docs/mcp/deploy-mcp-servers-to-vercel). Have not come up with a plan for phone app, like the idea of monolith repo for project but still to be decided most popular way to do this.


Debugging tools
Claude Code will be connected to everything on the software stack, utilizing skills in supabase and playwright the claude code agent can execute commands directly to introspect on the database up to check the UI and take screenshots of the UX/UI. 

Claude code will have a demo account but also access to all user accounts where it can login to that users profile with playwright to see data, test the form, validate various test cases and proof through product.

Claude will demo the user workflow from the my ideal target customer users perspective and analyze how well the user experience goes.

Financial functions will be test on discrete tests setup and validated by Jest for typescript.

Large scale notification Test and Evaluation framework BrainTrust

Considerations for where I think users will go in the future. I believe that the future of software is connectors to AI chats such as Claude, ChatGPT, etc. A user will connect all their software to these technologies for context about their entire online presence. Web apps will mostly be a very visual interface they can interact with visual and a bit gamified displays (scrolling, gaming, beautiful dashboards, maps). There will be a lot less form filling out even onboarding will be an exciting journey of inspiration.
