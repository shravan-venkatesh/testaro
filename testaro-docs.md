# Tools tested

1. alfa
2. Axe
3. Equal Access,
4. HTML CodeSniffer
5. Nu Html Checker
6. QualWeb
7. Testaro
8. WAVE

# Testaro's advantage

Until now, no project integrating multiple accessibility testing
tools under programmatic control with standardized reporting has
been discovered. Pa11y, kayle, and AATT integrate 2
tools: Axe and HTML CodeSniffer. Although a11yTools integrates
5 tools and 13 single-issue tests, it runs only one tool or test at a
time, and only under human control.

# Testaro's functioning and architecture

1. Testaro tests the way humans do. It launches web browsers, navigates to web pages, performs actions, checks whether the pages
behave as expected, and notes the results. Hence, it runs on a Windows, MacOS, or Ubuntu workstation

2. Testaro uses Playwright to launch and control Chromium, Webkit, and Firefox browsers.

3. Testaro is an NPM package that performs its own tests and those
of 7 other tools, of which one is a remote service and the others are installed dependencies. Among them, they check compliance with about 650 rules

# What is the process? 

## Job

A job gives information(metadata) and instructions(acts) to testaro.
The core of a job is its acts, an array or instructions that are set to be executed. There are 19 act types, which include:
1. Actions on a page
2. Navigation amongst pages
3. Tool executions

As a job is performed, testaro adds result to the acts. At the end of the job, Testaro adds the whole-data to the job and returns the elaborated job as a report

## Act
The act tells testaro 
- Which of the 9 tools should be executed
- Which rule of that tool should be executed
- Which of the 3 browsers should be used to test
- How granular the output should be
- Other options 
An example for an act, telling testaro to make the alfa tool perform tests for two of its rules:
``` 
    {
        type: 'test',
        which: 'alfa',
        what: 'Siteimprove alfa tool',
        rules: ['r25', 'r71'] 
    } 
```

# Efficiencies - The why?

- Testaro is designed to **streamline tool installation and configuration**. Options made available by all the tools are documented in one location and selected in the job file with uniform syntax.
- A job that includes all the tests of all the tools
typically takes about 3 minutes. If that were not fast enough, execution could be further accelerated with job partitioning: installing Testaro on multiple workstations, having them perform complementary jobs in parallel, and combining their reports
- Finally, Testaro is designed to make the utilization of tool reports more efficient. For this purpose, Testaro translates the most common elements of native tool reports into standard results. Fully documented in the README.md file, the standard results uniformly present each tool’s reports of violations of its rules, including what rule was violated, how serious the estimated impact is (on a 0-to3 ordinal scale), what HTML element was involved, where on the page it appeared, and an excerpt from the HTML code.
Here is an example of an entry from a standard result:

```
{
    totals: [23, 11, 6, 8],
    instances: [
        {
        ruleID: 'image-no-alt',
        what: img element has no text alternative,
        count: 1,
        ordinalSeverity: 3,
        tagName: 'IMG',
        id: 'ocean-beach-sunset',
        location: {
        doc: 'dom',
        type: 'xpath',
        spec: '/html/body/div[4]/p[2]/img[1]'
        }
        excerpt: <img src="images/obSunset.jpg">
        },
    ...
    ]
}
```
In this example, a tool reported 23 instances of rule violations
at severity 0, 11 at severity 1, etc. The first reported instance was an img element that violated a rule named image-no-alt.

### Note: 
Given the diverse ontologies of the tools, any standardization reflects some judgment. An example is the ordinalSeverity property, which interprets and combines the tools’ various classifications of severity, priority, and certainty. Users are free to rely on
the standardization performed by Testaro to simplify report consumption, but, if they want more control, they may extract data
from original tool results, too

# Testaro customization and integration
Users can customize Testaro by any of these methods:
 - Creating a tool and addign it as an installed dependency
 - Creating a tool and adding it as a remote service
 - Extending any of the tools, if it permits, by adding new rules to it. 


The Testaro tool contains a template for the creation of custom
rules. Existing Testaro rules are typically defined in 10 to 30 lines of code. A custom rule would likely require a similar amount of code


## Link to the Testaro paper
[Testaro](https://arxiv.org/pdf/2309.10167.pdf "Testaro paper Sept 2023")