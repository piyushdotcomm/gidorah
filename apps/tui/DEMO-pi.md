# Gidorah pi-tui demo

Deterministic frames rendered by pi-tui components with a fake terminal; no network.

### 0. Welcome + mock-mode banner
```text
Gidorah  the governed coding agent
cwd: /repo  ·  branch: main  ·  session: ses_demo  ·  mode: mock  ·  model: gidorah-auto
MOCK MODE — synthetic replies; no real model. Start Bifrost and set GIDORAH_MODE=cloud for real     
coding. Use `gidorah tui --demo` for the scripted demo.                                             
mode mock · route glm · $0.0016 · research 1/50 · dlp clean · cache 12% · ctx 8% · compact off
Welcome to Gidorah                                                                                  
mode: mock · model: gidorah-auto                                                                    
/help  /status  /model  /budget  /trace  /receipt  /new  /resume  /quit                             
Enter send · Shift+Enter newline · Tab complete · Ctrl+O tools · Ctrl+D quit                        
› Type a task, /help for commands                                                                   
```

### 1. Header, status, Markdown assistant, tool card
```text
Gidorah  the governed coding agent
cwd: /repo  ·  branch: main  ·  session: ses_demo  ·  mode: mock  ·  model: gidorah-auto
MOCK MODE — synthetic replies; no real model. Start Bifrost and set GIDORAH_MODE=cloud for real     
coding. Use `gidorah tui --demo` for the scripted demo.                                             
mode mock · route glm · $0.0016 · research 1/50 · dlp clean · cache 12% · ctx 8% · compact off
Welcome to Gidorah                                                                                  
mode: mock · model: gidorah-auto                                                                    
/help  /status  /model  /budget  /trace  /receipt  /new  /resume  /quit                             
Enter send · Shift+Enter newline · Tab complete · Ctrl+O tools · Ctrl+D quit                        
› patch greeting.txt and verify the runtime                                                         
I'll patch greeting.txt and then check the runtime.                                                 
                                                                                                    
- read the file                                                                                     
- apply the edit                                                                                    
- run the test                                                                                      
⚙ edit greeting.txt  hello -> hello, world [ok 19ms]                                                
  patched greeting.txt (5 -> 12 chars)                                                              
› Type a task, /help for commands                                                                   
```

### 2. Edit approval overlay with numbered diff
```text
Gidorah  the governed coding agent
cwd: /repo  ·  branch: main  ·  session: ses_demo  ·  mode: mock  ·  model: gidorah-auto
MOCK MODE — synthetic replies; no real model. Start Bifrost and set GIDORAH_MODE=cloud for real     
coding. Use `gidorah tui --demo` for the scripted demo.                                             
mode mock · route glm · $0.0016 · research 1/50 · dlp clean · cache 12% · ctx 8% · compact off
Welcome to Gidorah                                                                                  
mode: mock · model: gidorah-auto                                                                    
/help  /status  /model  /budget  /trace  /receipt  /new  /resume  /quit                             
Enter send · Shift+Enter newline · Tab complete · Ctrl+O tools · Ctrl+D quit                        
› patch greeting.txt and verify the runtime                                                         
I'll patch greeting.txt and then check the runtime.                                                 
                                                                                                    
- read the file                                                                                     
- apply the edit                                                                                    
- run the test                                                                                      
⚙ edit greeting.txt  hello -> hello, world [ok 19ms]                                                
  patched greeting.txt (5 -> 12 chars)                                                              
┌─ approval required (1 pending) ──────────────────────────────────────────────────────────────────┐
│ edit (risk: write)                                                                               │
│     @ greeting.txt                                                                               │
│   1 - hello                                                                                      │
│   2 + hello, world                                                                               │
│ [y] allow   [n] deny   [Esc] deny                                                                │
└──────────────────────────────────────────────────────────────────────────────────────────────────┘
› Type a task, /help for commands                                                                   
```

### 3. Denied shell card, research card, takeover, receipt
```text
Gidorah  the governed coding agent
cwd: /repo  ·  branch: main  ·  session: ses_demo  ·  mode: mock  ·  model: gidorah-auto
MOCK MODE — synthetic replies; no real model. Start Bifrost and set GIDORAH_MODE=cloud for real     
coding. Use `gidorah tui --demo` for the scripted demo.                                             
mode mock · route glm · $0.0016 · research 1/50 · dlp clean · cache 12% · ctx 8% · compact off
Welcome to Gidorah                                                                                  
mode: mock · model: gidorah-auto                                                                    
/help  /status  /model  /budget  /trace  /receipt  /new  /resume  /quit                             
Enter send · Shift+Enter newline · Tab complete · Ctrl+O tools · Ctrl+D quit                        
› patch greeting.txt and verify the runtime                                                         
I'll patch greeting.txt and then check the runtime.                                                 
                                                                                                    
- read the file                                                                                     
- apply the edit                                                                                    
- run the test                                                                                      
⚙ edit greeting.txt  hello -> hello, world [ok 19ms]                                                
  patched greeting.txt (5 -> 12 chars)                                                              
⚙ bash npm test -- --watch [denied 4ms]                                                             
  Denied by policy                                                                                  
≈ research: high confidence · 180 tokens                                                            
  sources: https://nodejs.org/api/globals.html#abortsignalany                                       
⇄ takeover: fireworks/deepseek-v4p1-flash → fireworks/glm-5p3-flash (fallback #1)                   
✓ receipt: success · 2000 tokens · $0.0016 · 1 fallback(s)                                          
› Type a task, /help for commands                                                                   
```

### 4. /status, /trace, /receipt output
```text
Gidorah  the governed coding agent
cwd: /repo  ·  branch: main  ·  session: ses_demo  ·  mode: mock  ·  model: gidorah-auto
MOCK MODE — synthetic replies; no real model. Start Bifrost and set GIDORAH_MODE=cloud for real     
coding. Use `gidorah tui --demo` for the scripted demo.                                             
mode mock · route glm · $0.0016 · research 1/50 · dlp clean · cache 12% · ctx 8% · compact off
Welcome to Gidorah                                                                                  
mode: mock · model: gidorah-auto                                                                    
/help  /status  /model  /budget  /trace  /receipt  /new  /resume  /quit                             
Enter send · Shift+Enter newline · Tab complete · Ctrl+O tools · Ctrl+D quit                        
› patch greeting.txt and verify the runtime                                                         
I'll patch greeting.txt and then check the runtime.                                                 
                                                                                                    
- read the file                                                                                     
- apply the edit                                                                                    
- run the test                                                                                      
⚙ edit greeting.txt  hello -> hello, world [ok 19ms]                                                
  patched greeting.txt (5 -> 12 chars)                                                              
⚙ bash npm test -- --watch [denied 4ms]                                                             
  Denied by policy                                                                                  
≈ research: high confidence · 180 tokens                                                            
  sources: https://nodejs.org/api/globals.html#abortsignalany                                       
⇄ takeover: fireworks/deepseek-v4p1-flash → fireworks/glm-5p3-flash (fallback #1)                   
✓ receipt: success · 2000 tokens · $0.0016 · 1 fallback(s)                                          
· session ses_demo · cwd /repo · mode mock · model gidorah-auto · budget $0.0016/$1.00              
· explore: fireworks/glm-5p3-flash · 500 tokens · $0.000400 · fallback no                           
· success · 2000 tokens · $0.0016 · 1 fallback(s)                                                   
› Type a task, /help for commands                                                                   
```

### 5. Searchable /resume picker
```text
Gidorah  the governed coding agent
cwd: /repo  ·  branch: main  ·  session: ses_demo  ·  mode: mock  ·  model: gidorah-auto
MOCK MODE — synthetic replies; no real model. Start Bifrost and set GIDORAH_MODE=cloud for real     
coding. Use `gidorah tui --demo` for the scripted demo.                                             
mode mock · route glm · $0.0016 · research 1/50 · dlp clean · cache 12% · ctx 8% · compact off
Welcome to Gidorah                                                                                  
mode: mock · model: gidorah-auto                                                                    
/help  /status  /model  /budget  /trace  /receipt  /new  /resume  /quit                             
Enter send · Shift+Enter newline · Tab complete · Ctrl+O tools · Ctrl+D quit                        
› patch greeting.txt and verify the runtime                                                         
I'll patch greeting.txt and then check the runtime.                                                 
                                                                                                    
- read the file                                                                                     
- apply the edit                                                                                    
- run the test                                                                                      
⚙ edit greeting.txt  hello -> hello, world [ok 19ms]                                                
  patched greeting.txt (5 -> 12 chars)                                                              
⚙ bash npm test -- --watch [denied 4ms]                                                             
  Denied by policy                                                                                  
≈ research: high confidence · 180 tokens                                                            
  sources: https://nodejs.org/api/globals.html#abortsignalany                                       
⇄ takeover: fireworks/deepseek-v4p1-flash → fireworks/glm-5p3-flash (fallback #1)                   
✓ receipt: success · 2000 tokens · $0.0016 · 1 fallback(s)                                          
· session ses_demo · cwd /repo · mode mock · model gidorah-auto · budget $0.0016/$1.00              
· explore: fireworks/glm-5p3-flash · 500 tokens · $0.000400 · fallback no                           
· success · 2000 tokens · $0.0016 · 1 fallback(s)                                                   
Resume session
search: _
────────────────────────────────────────────────────────────────────────────────────────────────────
› ses_demo · patch greeting.txt and verify the runtime
  ses_old · summarize what you changed
↑/↓ select · type to search · Enter resume · Esc cancel
› Type a task, /help for commands                                                                   
```

### 6. /model aliases
```text
Gidorah  the governed coding agent
cwd: /repo  ·  branch: main  ·  session: ses_demo  ·  mode: mock  ·  model: gidorah-auto
MOCK MODE — synthetic replies; no real model. Start Bifrost and set GIDORAH_MODE=cloud for real     
coding. Use `gidorah tui --demo` for the scripted demo.                                             
mode mock · route glm · $0.0016 · research 1/50 · dlp clean · cache 12% · ctx 8% · compact off
Welcome to Gidorah                                                                                  
mode: mock · model: gidorah-auto                                                                    
/help  /status  /model  /budget  /trace  /receipt  /new  /resume  /quit                             
Enter send · Shift+Enter newline · Tab complete · Ctrl+O tools · Ctrl+D quit                        
› patch greeting.txt and verify the runtime                                                         
I'll patch greeting.txt and then check the runtime.                                                 
                                                                                                    
- read the file                                                                                     
- apply the edit                                                                                    
- run the test                                                                                      
⚙ edit greeting.txt  hello -> hello, world [ok 19ms]                                                
  patched greeting.txt (5 -> 12 chars)                                                              
⚙ bash npm test -- --watch [denied 4ms]                                                             
  Denied by policy                                                                                  
≈ research: high confidence · 180 tokens                                                            
  sources: https://nodejs.org/api/globals.html#abortsignalany                                       
⇄ takeover: fireworks/deepseek-v4p1-flash → fireworks/glm-5p3-flash (fallback #1)                   
✓ receipt: success · 2000 tokens · $0.0016 · 1 fallback(s)                                          
· session ses_demo · cwd /repo · mode mock · model gidorah-auto · budget $0.0016/$1.00              
· explore: fireworks/glm-5p3-flash · 500 tokens · $0.000400 · fallback no                           
· success · 2000 tokens · $0.0016 · 1 fallback(s)                                                   
model gidorah-auto · available gidorah-auto,                                                        
fireworks/accounts/fireworks/models/deepseek-v4p1-flash, gidorah-local                              
› Type a task, /help for commands                                                                   
```

Frames rendered by pi-tui components with a fake terminal (`renderPiDemo`). The interactive path uses `ProcessTerminal`; this artifact is deterministic and offline.
