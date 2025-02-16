you're an expert full-stack web developer who writes thorough and production ready code. using ecmascript 2024 for nodejs v20.8.0 write a npm module named `tacos` that can be used from both the command line and in code.

the name if short for `Token And Context Output Summarizer`

use these real numbers

| Model                  | Input Cost (per 1M tokens) | Output Cost (per 1M tokens) | Context Window |
|------------------------|----------------------------|-----------------------------|----------------|
| **GPT-4-32k**          | $60.00                     | $120.00                     | 32K tokens     |
| **o1**                 | $15.00                     | $60.00                      | 200K tokens    |
| **GPT-4**              | $30.00                     | $60.00                      | 8K tokens      |
| **GPT-4 Turbo**        | $10.00                     | $30.00                      | 128K tokens    |
| **GPT-4o**             | $2.50                      | $10.00                      | 128K tokens    |
| **o3**                 | $6.00                      | $12.00                      | 200K tokens    |
| **o3-mini**            | $0.15                      | $0.60                       | 128K tokens    |
| **o1 Mini**            | $0.60                      | $2.40                       | 128K tokens    |
| **GPT-3.5 Turbo**      | $0.50                      | $1.50                       | 16K tokens     |
| **GPT-4o Mini**        | $0.15                      | $0.60                       | 128K tokens    |
| **text-embedding-3-small** | $0.02                  | N/A                         | N/A            |
| **text-embedding-3-large** | $0.13                  | N/A                         | N/A            |
| **ada v2**             | $0.10                      | N/A                         | N/A            |

as the tool, i should be using OpenAI’s tokenizer (such as `tiktoken` for OpenAI models), so that i can get more accurate counts.

### Features:
- Lists files in a directory (like `ls`)
- Counts tokens in text files
- Estimates cost based on model context input/output prices


furthermore it could look like e.g. (these are fake numbers),

```
$ tacos
183B    .env          1.2k    $0.4012    $0.1574  
0B      .git/         -       -          -       
44B     .gitignore    0.3k    $0.1023    $0.0488  
41B     .voxignore    0.2k    $0.0523    $0.0088  
8B      .nvmrc        0.1k    $0.0145    $0.0056  
8B      node_modules/ -       -          -  
1.1KB   LICENSE       2.8k    $0.9432    $0.3156  
103B    README.md     0.9k    $0.2734    $0.1129  

```

and if a file/folder is ignored, it should be dimmed with gray color text, while using yellow for tokens, green for dollars, and white for file size. leverage the remaining chalk colors to enrich the rest of the output like indicating executable files links and folders.

i could use it like such: `$ tacos gpt-4-turbo 3-large` and use `o3-mini` and `3-small` by default, so that i can specifiy if i want the models to use for calculation.

i should also be able to get the cost table like `$ tacos --cost-table`

don't used simplified approaches, and don't just demonstrate.

when generating source for a file, comment the file name at the top of the file. only respond with the file structure, and any new source code, e.g.,

```js 
// src/index.js
console.log('hi');
```
