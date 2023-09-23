/*
  run.js
  Testaro main utility module.
*/

// ########## IMPORTS

// Module to keep secrets.
require('dotenv').config();
// Requirements for acts.
const {actSpecs} = require('./actSpecs');
// Navigation.
const {browserClose, goTo, launch} = require('./procs/nav');
// Module to standardize report formats.
const {standardize} = require('./procs/standardize');

// ########## CONSTANTS

// Set DEBUG environment variable to 'true' to add debugging features.
const debug = process.env.DEBUG === 'true';
// Set WAITS environment variable to a positive number to insert delays (in ms).
const waits = Number.parseInt(process.env.WAITS) || 0;
// Set STANDARD environment variable to also if not set.
process.env.STANDARD ??= 'also';
// CSS selectors for targets of moves.
const moves = {
  button: 'button, [role=button], input[type=submit]',
  checkbox: 'input[type=checkbox]',
  focus: true,
  link: 'a, [role=link]',
  radio: 'input[type=radio]',
  search: 'input[type=search], input[aria-label*=search i], input[placeholder*=search i]',
  select: 'select',
  text: 'input'
};
// Names and descriptions of tools.
const tests = {
  alfa: 'alfa',
  aslint: 'ASLint',
  axe: 'Axe',
  htmlcs: 'HTML CodeSniffer WCAG 2.1 AA ruleset',
  ibm: 'IBM Accessibility Checker',
  nuVal: 'Nu Html Checker',
  qualWeb: 'QualWeb',
  testaro: 'Testaro',
  wave: 'WAVE',
};
// Items that may be waited for.
const waitables = ['url', 'title', 'body'];

// ########## VARIABLES

// Facts about the current session.
let actCount = 0;
// Facts about the current browser.
let browserContext;
let currentPage;
let requestedURL = '';

// ########## VALIDATORS

// Validates a browser type.
const isBrowserType = type => ['chromium', 'firefox', 'webkit'].includes(type);
// Validates a load state.
const isState = string => ['loaded', 'idle'].includes(string);
// Validates a URL.
const isURL = string => /^(?:https?|file):\/\/[^\s]+$/.test(string);
// Validates a focusable tag name.
const isFocusable = string => ['a', 'button', 'input', 'select'].includes(string);
// Returns whether all elements of an array are numbers.
const areNumbers = array => array.every(element => typeof element === 'number');
// Returns whether all elements of an array are strings.
const areStrings = array => array.every(element => typeof element === 'string');
// Returns whether all properties of an object have array values.
const areArrays = object => Object.values(object).every(value => Array.isArray(value));
// Returns whether a variable has a specified type.
const hasType = (variable, type) => {
  if (type === 'string') {
    return typeof variable === 'string';
  }
  else if (type === 'array') {
    return Array.isArray(variable);
  }
  else if (type === 'boolean') {
    return typeof variable === 'boolean';
  }
  else if (type === 'number') {
    return typeof variable === 'number';
  }
  else if (type === 'object') {
    return typeof variable === 'object' && ! Array.isArray(variable);
  }
  else {
    return false;
  }
};
// Returns whether a variable has a specified subtype.
const hasSubtype = (variable, subtype) => {
  if (subtype) {
    if (subtype === 'hasLength') {
      return variable.length > 0;
    }
    else if (subtype === 'isURL') {
      return isURL(variable);
    }
    else if (subtype === 'isBrowserType') {
      return isBrowserType(variable);
    }
    else if (subtype === 'isFocusable') {
      return isFocusable(variable);
    }
    else if (subtype === 'isTest') {
      return tests[variable];
    }
    else if (subtype === 'isWaitable') {
      return waitables.includes(variable);
    }
    else if (subtype === 'areNumbers') {
      return areNumbers(variable);
    }
    else if (subtype === 'areStrings') {
      return areStrings(variable);
    }
    else if (subtype === 'areArrays') {
      return areArrays(variable);
    }
    else if (subtype === 'isState') {
      return isState(variable);
    }
    else {
      console.log(`ERROR: ${subtype} not a known subtype`);
      return false;
    }
  }
  else {
    return true;
  }
};
// Validates an act.
const isValidAct = act => {
  // Identify the type of the act.
  const type = act.type;
  // If the type exists and is known:
  if (type && actSpecs.etc[type]) {
    // Copy the validator of the type for possible expansion.
    const validator = Object.assign({}, actSpecs.etc[type][1]);
    // If the type is test:
    if (type === 'test') {
      // Identify the test.
      const testName = act.which;
      // If one was specified and is known:
      if (testName && tests[testName]) {
        // If it has special properties:
        if (actSpecs.tests[testName]) {
          // Expand the validator by adding them.
          Object.assign(validator, actSpecs.tests[testName][1]);
        }
      }
      // Otherwise, i.e. if no or an unknown test was specified:
      else {
        // Return invalidity.
        return false;
      }
    }
    // Return whether the act is valid.
    return Object.keys(validator).every(property => {
      if (property === 'name') {
        return true;
      }
      else {
        const vP = validator[property];
        const aP = act[property];
        // If it is optional and omitted or is present and valid:
        const optAndNone = ! vP[0] && ! aP;
        const isValidAct = aP !== undefined && hasType(aP, vP[1]) && hasSubtype(aP, vP[2]);
        return optAndNone || isValidAct;
      }
    });
  }
  // Otherwise, i.e. if the act has an unknown or no type:
  else {
    // Return invalidity.
    return false;
  }
};
// Validates a report object.
const isValidReport = report => {
  if (report) {
    // Return whether the report is valid.
    const {id, what, strict, timeLimit, acts, sources, creationTime, timeStamp} = report;
    if (! id || typeof id !== 'string') {
      return 'Bad report ID';
    }
    if (! what || typeof what !== 'string') {
      return 'Bad report what';
    }
    if (typeof strict !== 'boolean') {
      return 'Bad report strict';
    }
    if (typeof timeLimit !== 'number' || timeLimit < 1) {
      return 'Bad report time limit';
    }
    if (! acts || ! Array.isArray(acts) || acts.length < 2) {
      return 'Bad report acts';
    }
    if (! acts.every(act => act.type && typeof act.type === 'string')) {
      return 'Act with no type';
    }
    if (acts[0].type !== 'launch') {
      return 'First act type not launch';
    }
    if (! ['chromium', 'webkit', 'firefox'].includes(acts[0].which)) {
      return 'Bad first act which';
    }
    if (acts[0].type !== 'launch' || (
      (
        ! acts[0].url
        || typeof acts[0].url !== 'string'
        || ! isURL(acts[0].url)
      )
      && (
        acts[1].type !== 'url'
        || ! acts[1].which
        || typeof acts[1].which !== 'string'
        || ! isURL(acts[1].which)
      )
    )) {
      return 'First or second act has no valid URL';
    }
    const invalidAct = acts.find(act => ! isValidAct(act));
    if (invalidAct) {
      return `Invalid act:\n${JSON.stringify(invalidAct, null, 2)}`;
    }
    if (! sources || typeof sources !== 'object') {
      return 'Bad report sources';
    }
    if (typeof sources.script !== 'string') {
      return 'Bad sources script';
    }
    if (
      ! creationTime
      || typeof creationTime !== 'string'
      || ! /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(creationTime)
    ) {
      return 'bad job creation time';
    }
    if (! timeStamp || typeof timeStamp !== 'string') {
      return 'bad report timestamp';
    }
    return '';
  }
  else {
    return 'no report';
  }
};

// ########## OTHER FUNCTIONS

// Returns a string representing the date and time.
const nowString = () => (new Date()).toISOString().slice(0, 19);
// Returns the first line of an error message.
const errorStart = error => error.message.replace(/\n.+/s, '');
// Normalizes spacing characters and cases in a string.
const debloat = string => string.replace(/\s/g, ' ').trim().replace(/ {2,}/g, ' ').toLowerCase();
// Returns the text of an element, lower-cased.
const textOf = async (page, element) => {
  if (element) {
    const tagNameJSHandle = await element.getProperty('tagName');
    const tagName = await tagNameJSHandle.jsonValue();
    let totalText = '';
    // If the element is a link, button, input, or select list:
    if (['A', 'BUTTON', 'INPUT', 'SELECT'].includes(tagName)) {
      // Return its visible labels, descriptions, and legend if the first input in a fieldset.
      totalText = await page.evaluate(element => {
        const {tagName, ariaLabel} = element;
        let ownText = '';
        if (['A', 'BUTTON'].includes(tagName)) {
          ownText = element.textContent;
        }
        else if (tagName === 'INPUT' && element.type === 'submit') {
          ownText = element.value;
        }
        // HTML link elements have no labels property.
        const labels = tagName !== 'A' ? Array.from(element.labels) : [];
        const labelTexts = labels.map(label => label.textContent);
        if (ariaLabel) {
          labelTexts.push(ariaLabel);
        }
        const refIDs = new Set([
          element.getAttribute('aria-labelledby') || '',
          element.getAttribute('aria-describedby') || ''
        ].join(' ').split(/\s+/));
        if (refIDs.size) {
          refIDs.forEach(id => {
            const labeler = document.getElementById(id);
            if (labeler) {
              const labelerText = labeler.textContent.trim();
              if (labelerText.length) {
                labelTexts.push(labelerText);
              }
            }
          });
        }
        let legendText = '';
        if (tagName === 'INPUT') {
          const fieldsets = Array.from(document.body.querySelectorAll('fieldset'));
          const inputFieldsets = fieldsets.filter(fieldset => {
            const inputs = Array.from(fieldset.querySelectorAll('input'));
            return inputs.length && inputs[0] === element;
          });
          const inputFieldset = inputFieldsets[0] || null;
          if (inputFieldset) {
            const legend = inputFieldset.querySelector('legend');
            if (legend) {
              legendText = legend.textContent;
            }
          }
        }
        return [legendText].concat(labelTexts, ownText).join(' ');
      }, element);
    }
    // Otherwise, if it is an option:
    else if (tagName === 'OPTION') {
      // Return its text content, prefixed with the text of its select parent if the first option.
      const ownText = await element.textContent();
      const indexJSHandle = await element.getProperty('index');
      const index = await indexJSHandle.jsonValue();
      if (index) {
        totalText = ownText;
      }
      else {
        const selectJSHandle = await page.evaluateHandle(
          element => element.parentElement, element
        );
        const select = await selectJSHandle.asElement();
        if (select) {
          const selectText = await textOf(page, select);
          totalText = [ownText, selectText].join(' ');
        }
        else {
          totalText = ownText;
        }
      }
    }
    // Otherwise, i.e. if it is not an input, select, or option:
    else {
      // Get its text content.
      totalText = await element.textContent();
    }
    return debloat(totalText);
  }
  else {
    return null;
  }
};
// Returns a property value and whether it satisfies an expectation.
const isTrue = (object, specs) => {
  const property = specs[0];
  const propertyTree = property.split('.');
  let actual = property.length ? object[propertyTree[0]] : object;
  // Identify the actual value of the specified property.
  while (propertyTree.length > 1 && actual !== undefined) {
    propertyTree.shift();
    actual = actual[propertyTree[0]];
  }
  // If the expectation is that the property does not exist:
  if (specs.length === 1) {
    // Return whether the expectation is satisfied.
    return [actual, actual === undefined];
  }
  // Otherwise, i.e. if the expectation is of a property value:
  else if (specs.length === 3) {
    // Return whether the expectation was fulfilled.
    const relation = specs[1];
    const criterion = specs[2];
    let satisfied;
    if (actual === undefined) {
      return [null, false];
    }
    else if (relation === '=') {
      satisfied = actual === criterion;
    }
    else if (relation === '<') {
      satisfied = actual < criterion;
    }
    else if (relation === '>') {
      satisfied = actual > criterion;
    }
    else if (relation === '!') {
      satisfied = actual !== criterion;
    }
    else if (relation === 'i') {
      satisfied = typeof actual === 'string' && actual.includes(criterion);
    }
    else if (relation === '!i') {
      satisfied = typeof actual === 'string' && ! actual.includes(criterion);
    }
    else if (relation === 'e') {
      satisfied = typeof actual === 'object'
      && JSON.stringify(actual) === JSON.stringify(criterion);
    }
    return [actual, satisfied];
  }
  // Otherwise, i.e. if the specifications are invalid:
  else {
    // Return this.
    return [null, false];
  }
};
// Adds a wait error result to an act.
const waitError = (page, act, error, what) => {
  console.log(`ERROR waiting for ${what} (${error.message})`);
  act.result.found = false;
  act.result.url = page.url();
  act.result.error = `ERROR waiting for ${what}`;
  return false;
};
// Waits.
const wait = ms => {
  return new Promise(resolve => {
    setTimeout(() => {
      resolve('');
    }, ms);
  });
};
// Adds an error result to an act.
const addError = (act, error, message) => {
  if (! act.result) {
    act.result = {};
  }
  act.result.success = false;
  act.result.error = error;
  act.result.message = message;
  if (act.type === 'test') {
    act.result.prevented = true;
  }
};
// Recursively performs the acts in a report.
const doActs = async (report, actIndex, page) => {
  // Quits and reports the performance being aborted.
  const abortActs = async () => {
    // Add data on the aborted act to the report.
    report.jobData.abortTime = nowString();
    report.jobData.abortedAct = actIndex;
    report.jobData.aborted = true;
    // Prevent performance of additional acts.
    actIndex = -2;
    // Report this.
    console.log('ERROR: Job aborted');
    // Stop the action until the user resumes it.
    await page.pause();
  };
  process.on('message', message => {
    if (message === 'interrupt') {
      console.log('ERROR: Terminal interrupted doActs');
      process.exit();
    }
  });
  const {acts} = report;
  // If any more acts are to be performed:
  if (actIndex > -1 && actIndex < acts.length) {
    // Identify the act to be performed.
    const act = acts[actIndex];
    // If it is valid:
    if (isValidAct(act)) {
      let actInfo = '';
      if (act.which) {
        if (act.type === 'launch' && act.url) {
          actInfo = `${act.which} to ${act.url}`;
        }
        else {
          actInfo = act.which;
        }
      }
      const whichSuffix = actInfo ? ` (${actInfo})` : '';
      console.log(`>>>> ${act.type}${whichSuffix}`);
      // Increment the count of acts performed.
      actCount++;
      act.startTime = Date.now();
      // If the act is an index changer:
      if (act.type === 'next') {
        const condition = act.if;
        const logSuffix = condition.length === 3 ? ` ${condition[1]} ${condition[2]}` : '';
        console.log(`>> ${condition[0]}${logSuffix}`);
        // Identify the act to be checked.
        const ifActIndex = report.acts.map(act => act.type !== 'next').lastIndexOf(true);
        // Determine whether its jump condition is true.
        const truth = isTrue(report.acts[ifActIndex].result, condition);
        // Add the result to the act.
        act.result = {
          property: condition[0],
          relation: condition[1],
          criterion: condition[2],
          value: truth[0],
          jumpRequired: truth[1]
        };
        // If the condition is true:
        if (truth[1]) {
          // If the performance of acts is to stop:
          if (act.jump === 0) {
            // Quit.
            actIndex = -2;
          }
          // Otherwise, if there is a numerical jump:
          else if (act.jump) {
            // Set the act index accordingly.
            actIndex += act.jump - 1;
          }
          // Otherwise, if there is a named next act:
          else if (act.next) {
            // Set the new index accordingly, or stop if it does not exist.
            actIndex = acts.map(act => act.name).indexOf(act.next) - 1;
          }
        }
      }
      // Otherwise, if the act is a launch:
      else if (act.type === 'launch') {
        // Launch the specified browser and navigate to the specified URL.
        const browserData = await launch(
          report, act.which, act.url, debug, waits, act.lowMotion ? 'reduce' : 'no-preference'
        );
        // If the launch and navigation succeeded:
        if (browserData) {
          // Save the browser data.
          browserContext = browserData.browserContext;
          currentPage = browserData.currentPage;
          page = currentPage;
          // Add the actual URL to the act.
          act.actualURL = page.url();
        }
        // Otherwise, i.e. if the launch or navigation failed:
        else {
          // Abort the job.
          await abortActs();
        }
      }
      // Otherwise, if a current page exists:
      else if (page) {
        // If the act is navigation to a url:
        if (act.type === 'url') {
          // Identify the URL.
          const resolved = act.which.replace('__dirname', __dirname);
          requestedURL = resolved;
          // Visit it and wait until the DOM is loaded.
          const response = await goTo(report, page, requestedURL, 15000, 'domcontentloaded');
          // If the visit failed:
          if (response.error) {
            // Report this and quit.
            addError(act, 'failure', 'ERROR: Visits failed');
            await abortActs();
          }
          // Otherwise, i.e. if the visit succeeded:
          else {
            // If a prohibited redirection occurred:
            if (response.exception === 'badRedirection') {
              // Report this and quit.
              addError(act, 'badRedirection', 'ERROR: Navigation illicitly redirected');
              await abortActs();
            }
            // Add the resulting URL to the act.
            if (! act.result) {
              act.result = {};
            }
            act.result.url = page.url();
            // If the response includes a content security policy:
            const csp = response.headers && response.headers['Content-Security-Policy'];
            if (csp) {
              // If it requires scripts to have a nonce:
              const directives = csp.split(/ * ; */).map(directive => directive.split(/ +/));
              const scriptDirective = directives.find(dir => dir[0] === 'script-src');
              if (scriptDirective) {
                const nonceSpec = scriptDirective.find(valPart => valPart.startsWith('nonce-'));
                if (nonceSpec) {
                  // Add the nonce to the act.
                  const nonce = nonceSpec.replace(/^nonce-/, '');
                  act.cspNonce = nonce;
                }
              }
            }
          }
        }
        // Otherwise, if the act is a wait for text:
        else if (act.type === 'wait') {
          const {what, which} = act;
          console.log(`>> ${what}`);
          const result = act.result = {};
          // If the text is to be the URL:
          if (what === 'url') {
            // Wait for the URL to be the exact text.
            try {
              await page.waitForURL(which, {timeout: 15000});
              result.found = true;
              result.url = page.url();
            }
            // If the wait times out:
            catch(error) {
              // Quit.
              await abortActs();
              waitError(page, act, error, 'text in the URL');
            }
          }
          // Otherwise, if the text is to be a substring of the page title:
          else if (what === 'title') {
            // Wait for the page title to include the text, case-insensitively.
            try {
              await page.waitForFunction(
                text => document
                && document.title
                && document.title.toLowerCase().includes(text.toLowerCase()),
                which,
                {
                  polling: 1000,
                  timeout: 5000
                }
              );
              result.found = true;
              result.title = await page.title();
            }
            // If the wait times out:
            catch(error) {
              // Quit.
              await abortActs();
              waitError(page, act, error, 'text in the title');
            }
          }
          // Otherwise, if the text is to be a substring of the text of the page body:
          else if (what === 'body') {
            // Wait for the body to include the text, case-insensitively.
            try {
              await page.waitForFunction(
                text => document
                && document.body
                && document.body.innerText.toLowerCase().includes(text.toLowerCase()),
                which,
                {
                  polling: 2000,
                  timeout: 15000
                }
              );
              result.found = true;
            }
            // If the wait times out:
            catch(error) {
              // Quit.
              await abortActs();
              waitError(page, act, error, 'text in the body');
            }
          }
        }
        // Otherwise, if the act is a wait for a state:
        else if (act.type === 'state') {
          // Wait for it.
          const stateIndex = ['loaded', 'idle'].indexOf(act.which);
          await page.waitForLoadState(
            ['domcontentloaded', 'networkidle'][stateIndex], {timeout: [10000, 15000][stateIndex]}
          )
          // If the wait times out:
          .catch(async error => {
            // Quit.
            console.log(`ERROR waiting for page to be ${act.which} (${error.message})`);
            addError(act, 'timeout', `ERROR waiting for page to be ${act.which}`);
            await abortActs();
          });
          // If the wait succeeded:
          if (actIndex > -2) {
            // Add state data to the report.
            act.result = {
              success: true,
              state: act.which
            };
          }
        }
        // Otherwise, if the act is a page switch:
        else if (act.type === 'page') {
          // Wait for a page to be created and identify it as current.
          page = await browserContext.waitForEvent('page');
          // Wait until it is idle.
          await page.waitForLoadState('networkidle', {timeout: 15000});
          // Add the resulting URL to the act.
          const result = {
            url: page.url()
          };
          act.result = result;
        }
        // Otherwise, if the page has a URL:
        else if (page.url() && page.url() !== 'about:blank') {
          const url = page.url();
          // Add the URL to the act.
          act.actualURL = url;
          // If the act is a revelation:
          if (act.type === 'reveal') {
            // Make all elements in the page visible.
            await require('./procs/allVis').allVis(page);
            act.result = {
              success: true
            };
          }
          // Otherwise, if the act performs tests of a tool:
          else if (act.type === 'test') {
            // Add a description of the test to the act.
            act.what = tests[act.which];
            // Initialize the options argument.
            const options = {};
            // Add any specified arguments to it.
            Object.keys(act).forEach(key => {
              if (! ['type', 'which'].includes(key)) {
                options[key] = act[key];
              }
            });
            // Initialize the test report.
            const startTime = Date.now();
            let toolReport = {
              result: {
                success: false
              }
            };
            // Perform the specified tests of the tool and get a report.
            try {
              const args = [page, options];
              toolReport = await require(`./tests/${act.which}`).reporter(... args);
              toolReport.result.success = true;
            }
            // If the testing failed:
            catch(error) {
              // Report this but do not abort the job.
              console.log(`ERROR: Test act ${act.which} failed (${error.message.slice(0, 400)})`);
            }
            // Add the elapsed time to the report.
            const time = Math.round((Date.now() - startTime) / 1000);
            const {toolTimes} = report.jobData;
            if (! toolTimes[act.which]) {
              toolTimes[act.which] = 0;
            }
            toolTimes[act.which] += time;
            // Add the result object (possibly an array) to the act.
            const resultCount = Object.keys(toolReport.result).length;
            act.result = resultCount ? toolReport.result : {success: false};
            // If a standard-format result is to be included in the report:
            const standard = process.env.STANDARD;
            if (['also', 'only'].includes(standard)) {
              // Initialize it.
              act.standardResult = {
                totals: [],
                instances: []
              };
              // Populate it.
              standardize(act);
              // If the original-format result is not to be included in the report:
              if (standard === 'only') {
                // Remove it.
                delete act.result;
              }
              // If the test has expectations:
              const expectations = act.expect;
              if (expectations) {
                // Initialize whether they were fulfilled.
                act.expectations = [];
                let failureCount = 0;
                // For each expectation:
                expectations.forEach(spec => {
                  const truth = isTrue(act, spec);
                  act.expectations.push({
                    property: spec[0],
                    relation: spec[1],
                    criterion: spec[2],
                    actual: truth[0],
                    passed: truth[1]
                  });
                  if (! truth[1]) {
                    failureCount++;
                  }
                });
                act.expectationFailures = failureCount;
              }
            }
          }
          // Otherwise, if the act is a move:
          else if (moves[act.type]) {
            const selector = typeof moves[act.type] === 'string' ? moves[act.type] : act.what;
            // Try up to 5 times to:
            act.result = {found: false};
            let selection = {};
            let tries = 0;
            const slimText = act.which ? debloat(act.which) : '';
            while (tries++ < 5 && ! act.result.found) {
              if (page) {
                // Identify the elements of the specified type.
                const selections = await page.$$(selector);
                // If there are any:
                if (selections.length) {
                  // If there are enough to make a match possible:
                  if ((act.index || 0) < selections.length) {
                    // For each element of the specified type:
                    let matchCount = 0;
                    const selectionTexts = [];
                    for (selection of selections) {
                      // Add its lower-case text or an empty string to the list of element texts.
                      const selectionText = slimText ? await textOf(page, selection) : '';
                      selectionTexts.push(selectionText);
                      // If its text includes any specified text, case-insensitively:
                      if (selectionText.includes(slimText)) {
                        // If the element has the specified index among such elements:
                        if (matchCount++ === (act.index || 0)) {
                          // Report it as the matching element and stop checking.
                          act.result.found = true;
                          act.result.textSpec = slimText;
                          act.result.textContent = selectionText;
                          break;
                        }
                      }
                    }
                    // If no element satisfied the specifications:
                    if (! act.result.found) {
                      // Add the failure data to the report.
                      act.result.success = false;
                      act.result.error = 'exhausted';
                      act.result.typeElementCount = selections.length;
                      if (slimText) {
                        act.result.textElementCount = --matchCount;
                      }
                      act.result.message = 'Not enough specified elements exist';
                      act.result.candidateTexts = selectionTexts;
                    }
                  }
                  // Otherwise, i.e. if there are too few such elements to make a match possible:
                  else {
                    // Add the failure data to the report.
                    act.result.success = false;
                    act.result.error = 'fewer';
                    act.result.typeElementCount = selections.length;
                    act.result.message = 'Elements of specified type too few';
                  }
                }
                // Otherwise, i.e. if there are no elements of the specified type:
                else {
                  // Add the failure data to the report.
                  act.result.success = false;
                  act.result.error = 'none';
                  act.result.typeElementCount = 0;
                  act.result.message = 'No elements of specified type found';
                }
              }
              // Otherwise, i.e. if the page no longer exists:
              else {
                // Add the failure data to the report.
                act.result.success = false;
                act.result.error = 'gone';
                act.result.message = 'Page gone';
              }
              if (! act.result.found) {
                await wait(2000);
              }
            }
            // If a match was found:
            if (act.result.found) {
              // FUNCTION DEFINITION START
              // Performs a click or Enter keypress and waits for the network to be idle.
              const doAndWait = async isClick => {
                // Perform and report the move.
                const move = isClick ? 'click' : 'Enter keypress';
                try {
                  await isClick
                    ? selection.click({timeout: 4000})
                    : selection.press('Enter', {timeout: 4000});
                  act.result.success = true;
                  act.result.move = move;
                }
                // If the move fails:
                catch(error) {
                  // Quit and add failure data to the report.
                  act.result.success = false;
                  act.result.error = 'moveFailure';
                  act.result.message = `ERROR: ${move} failed`;
                  console.log(`ERROR: ${move} failed (${errorStart(error)})`);
                  await abortActs();
                }
                if (act.result.success) {
                  try {
                    await page.context().waitForEvent('networkidle', {timeout: 10000});
                    act.result.idleTimely = true;
                  }
                  catch(error) {
                    console.log(`ERROR: Network busy after ${move} (${errorStart(error)})`);
                    act.result.idleTimely = false;
                  }
                  // If the move created a new page, make it current.
                  page = currentPage;
                  act.result.newURL = page.url();
                }
              };
              // FUNCTION DEFINITION END
              // If the move is a button click, perform it.
              if (act.type === 'button') {
                await selection.click({timeout: 3000});
                act.result.success = true;
                act.result.move = 'clicked';
              }
              // Otherwise, if it is checking a radio button or checkbox, perform it.
              else if (['checkbox', 'radio'].includes(act.type)) {
                await selection.waitForElementState('stable', {timeout: 2000})
                .catch(error => {
                  console.log(`ERROR waiting for stable ${act.type} (${error.message})`);
                  act.result.success = false;
                  act.result.error = `ERROR waiting for stable ${act.type}`;
                });
                if (! act.result.error) {
                  const isEnabled = await selection.isEnabled();
                  if (isEnabled) {
                    await selection.check({
                      force: true,
                      timeout: 2000
                    })
                    .catch(error => {
                      console.log(`ERROR checking ${act.type} (${error.message})`);
                      act.result.success = false;
                      act.result.error = `ERROR checking ${act.type}`;
                    });
                    if (! act.result.error) {
                      act.result.success = true;
                      act.result.move = 'checked';
                    }
                  }
                  else {
                    const report = `ERROR: could not check ${act.type} because disabled`;
                    console.log(report);
                    act.result.success = false;
                    act.result.error = report;
                  }
                }
              }
              // Otherwise, if it is focusing the element, perform it.
              else if (act.type === 'focus') {
                await selection.focus({timeout: 2000});
                act.result.success = true;
                act.result.move = 'focused';
              }
              // Otherwise, if it is clicking a link:
              else if (act.type === 'link') {
                const href = await selection.getAttribute('href');
                const target = await selection.getAttribute('target');
                act.result.href = href || 'NONE';
                act.result.target = target || 'DEFAULT';
                // If the destination is a new page:
                if (target && target !== '_self') {
                  // Click the link and wait for the network to be idle.
                  doAndWait(true);
                }
                // Otherwise, i.e. if the destination is in the current page:
                else {
                  // Click the link and wait for the resulting navigation.
                  try {
                    await selection.click({timeout: 5000});
                    // Wait for the new content to load.
                    await page.waitForLoadState('domcontentloaded', {timeout: 6000});
                    act.result.success = true;
                    act.result.move = 'clicked';
                    act.result.newURL = page.url();
                  }
                  // If the click or load failed:
                  catch(error) {
                    // Quit and add failure data to the report.
                    console.log(`ERROR clicking link (${errorStart(error)})`);
                    act.result.success = false;
                    act.result.error = 'unclickable';
                    act.result.message = 'ERROR: click or load timed out';
                    await abortActs();
                  }
                  // If the link click succeeded:
                  if (! act.result.error) {
                    // Add success data to the report.
                    act.result.success = true;
                    act.result.move = 'clicked';
                  }
                }
              }
              // Otherwise, if it is selecting an option in a select list, perform it.
              else if (act.type === 'select') {
                const options = await selection.$$('option');
                let optionText = '';
                if (options && Array.isArray(options) && options.length) {
                  const optionTexts = [];
                  for (const option of options) {
                    const optionText = await option.textContent();
                    optionTexts.push(optionText);
                  }
                  const matchTexts = optionTexts.map(
                    (text, index) => text.includes(act.what) ? index : -1
                  );
                  const index = matchTexts.filter(text => text > -1)[act.index || 0];
                  if (index !== undefined) {
                    await selection.selectOption({index});
                    optionText = optionTexts[index];
                  }
                }
                act.result.success = true;
                act.result.move = 'selected';
                act.result.option = optionText;
              }
              // Otherwise, if it is entering text in an input element:
              else if (['text', 'search'].includes(act.type)) {
                act.result.attributes = {};
                const {attributes} = act.result;
                const type = await selection.getAttribute('type');
                const label = await selection.getAttribute('aria-label');
                const labelRefs = await selection.getAttribute('aria-labelledby');
                attributes.type = type || '';
                attributes.label = label || '';
                attributes.labelRefs = labelRefs || '';
                // If the text contains a placeholder for an environment variable:
                let {what} = act;
                if (/__[A-Z]+__/.test(what)) {
                  // Replace it.
                  const envKey = /__([A-Z]+)__/.exec(what)[1];
                  const envValue = process.env[envKey];
                  what = what.replace(/__[A-Z]+__/, envValue);
                }
                // Enter the text.
                await selection.type(act.what);
                report.jobData.presses += act.what.length;
                act.result.success = true;
                act.result.move = 'entered';
                // If the input is a search input:
                if (act.type === 'search') {
                  // Press the Enter key and wait for a network to be idle.
                  doAndWait(false);
                }
              }
              // Otherwise, i.e. if the move is unknown, add the failure to the act.
              else {
                // Report the error.
                const report = 'ERROR: move unknown';
                act.result.success = false;
                act.result.error = report;
                console.log(report);
              }
            }
            // Otherwise, i.e. if no match was found:
            else {
              // Quit and add failure data to the report.
              act.result.success = false;
              act.result.error = 'absent';
              act.result.message = 'ERROR: specified element not found';
              console.log('ERROR: Specified element not found');
              await abortActs();
            }
          }
          // Otherwise, if the act is a keypress:
          else if (act.type === 'press') {
            // Identify the number of times to press the key.
            let times = 1 + (act.again || 0);
            report.jobData.presses += times;
            const key = act.which;
            // Press the key.
            while (times--) {
              await page.keyboard.press(key);
            }
            const qualifier = act.again ? `${1 + act.again} times` : 'once';
            act.result = {
              success: true,
              message: `pressed ${qualifier}`
            };
          }
          // Otherwise, if it is a repetitive keyboard navigation:
          else if (act.type === 'presses') {
            const {navKey, what, which, withItems} = act;
            const matchTexts = which ? which.map(text => debloat(text)) : [];
            // Initialize the loop variables.
            let status = 'more';
            let presses = 0;
            let amountRead = 0;
            let items = [];
            let matchedText;
            // As long as a matching element has not been reached:
            while (status === 'more') {
              // Press the Escape key to dismiss any modal dialog.
              await page.keyboard.press('Escape');
              // Press the specified navigation key.
              await page.keyboard.press(navKey);
              presses++;
              // Identify the newly current element or a failure.
              const currentJSHandle = await page.evaluateHandle(actCount => {
                // Initialize it as the focused element.
                let currentElement = document.activeElement;
                // If it exists in the page:
                if (currentElement && currentElement.tagName !== 'BODY') {
                  // Change it, if necessary, to its active descendant.
                  if (currentElement.hasAttribute('aria-activedescendant')) {
                    currentElement = document.getElementById(
                      currentElement.getAttribute('aria-activedescendant')
                    );
                  }
                  // Or change it, if necessary, to its selected option.
                  else if (currentElement.tagName === 'SELECT') {
                    const currentIndex = Math.max(0, currentElement.selectedIndex);
                    const options = currentElement.querySelectorAll('option');
                    currentElement = options[currentIndex];
                  }
                  // Or change it, if necessary, to its active shadow-DOM element.
                  else if (currentElement.shadowRoot) {
                    currentElement = currentElement.shadowRoot.activeElement;
                  }
                  // If there is a current element:
                  if (currentElement) {
                    // If it was already reached within this act:
                    if (currentElement.dataset.pressesReached === actCount.toString(10)) {
                      // Report the error.
                      console.log(`ERROR: ${currentElement.tagName} element reached again`);
                      status = 'ERROR';
                      return 'ERROR: locallyExhausted';
                    }
                    // Otherwise, i.e. if it is newly reached within this act:
                    else {
                      // Mark and return it.
                      currentElement.dataset.pressesReached = actCount;
                      return currentElement;
                    }
                  }
                  // Otherwise, i.e. if there is no current element:
                  else {
                    // Report the error.
                    status = 'ERROR';
                    return 'noActiveElement';
                  }
                }
                // Otherwise, i.e. if there is no focus in the page:
                else {
                  // Report the error.
                  status = 'ERROR';
                  return 'ERROR: globallyExhausted';
                }
              }, actCount);
              // If the current element exists:
              const currentElement = currentJSHandle.asElement();
              if (currentElement) {
                // Update the data.
                const tagNameJSHandle = await currentElement.getProperty('tagName');
                const tagName = await tagNameJSHandle.jsonValue();
                const text = await textOf(page, currentElement);
                // If the text of the current element was found:
                if (text !== null) {
                  const textLength = text.length;
                  // If it is non-empty and there are texts to match:
                  if (matchTexts.length && textLength) {
                    // Identify the matching text.
                    matchedText = matchTexts.find(matchText => text.includes(matchText));
                  }
                  // Update the item data if required.
                  if (withItems) {
                    const itemData = {
                      tagName,
                      text,
                      textLength
                    };
                    if (matchedText) {
                      itemData.matchedText = matchedText;
                    }
                    items.push(itemData);
                  }
                  amountRead += textLength;
                  // If there is no text-match failure:
                  if (matchedText || ! matchTexts.length) {
                    // If the element has any specified tag name:
                    if (! what || tagName === what) {
                      // Change the status.
                      status = 'done';
                      // Perform the action.
                      const inputText = act.text;
                      if (inputText) {
                        await page.keyboard.type(inputText);
                        presses += inputText.length;
                      }
                      if (act.action) {
                        presses++;
                        await page.keyboard.press(act.action);
                        await page.waitForLoadState();
                      }
                    }
                  }
                }
                else {
                  status = 'ERROR';
                }
              }
              // Otherwise, i.e. if there was a failure:
              else {
                // Update the status.
                status = await currentJSHandle.jsonValue();
              }
            }
            // Add the result to the act.
            act.result = {
              success: true,
              status,
              totals: {
                presses,
                amountRead
              }
            };
            if (status === 'done' && matchedText) {
              act.result.matchedText = matchedText;
            }
            if (withItems) {
              act.result.items = items;
            }
            // Add the totals to the report.
            report.jobData.presses += presses;
            report.jobData.amountRead += amountRead;
          }
          // Otherwise, i.e. if the act type is unknown:
          else {
            // Add the error result to the act.
            addError(act, 'badType', 'ERROR: Invalid act type');
          }
        }
        // Otherwise, a page URL is required but does not exist, so:
        else {
          // Add an error result to the act.
          addError(act, 'noURL', 'ERROR: Page has no URL');
        }
      }
      // Otherwise, i.e. if no page exists:
      else {
        // Add an error result to the act.
        addError(act, 'noPage', 'ERROR: No page identified');
      }
      act.endTime = Date.now();
    }
    // Otherwise, i.e. if the act is invalid:
    else {
      // Quit and add error data to the report.
      const errorMsg = `ERROR: Invalid act of type ${act.type}`;
      console.log(errorMsg);
      addError(act, 'badAct', errorMsg);
      await abortActs();
    }
    // Perform any remaining acts if not aborted.
    await doActs(report, actIndex + 1, page);
  }
  // Otherwise, if all acts have been performed and the job succeeded:
  else if (! report.jobData.abortTime) {
    console.log('Acts completed');
    await browserClose();
  }
};
/*
  Returns whether an initialized job report is valid and, if so, runs the job and adds the results
  to the report.
*/
exports.doJob = async report => {
  // If the report is valid:
  const reportInvalidity = isValidReport(report);
  if (reportInvalidity) {
    console.log(reportInvalidity);
  }
  else {
    // Add initialized job data to the report.
    report.jobData = {};
    const startTime = new Date();
    report.jobData.startTime = nowString();
    report.jobData.endTime = '';
    report.jobData.elapsedSeconds = 0;
    report.jobData.visitLatency = 0;
    report.jobData.logCount = 0;
    report.jobData.logSize = 0;
    report.jobData.errorLogCount = 0;
    report.jobData.errorLogSize = 0;
    report.jobData.prohibitedCount = 0;
    report.jobData.visitRejectionCount = 0;
    report.jobData.aborted = false;
    report.jobData.abortedAct = null;
    report.jobData.presses = 0;
    report.jobData.amountRead = 0;
    report.jobData.toolTimes = {};
    // Recursively perform the acts.
    await doActs(report, 0, null);
    // Add the end time and duration to the report.
    const endTime = new Date();
    report.jobData.endTime = nowString();
    report.jobData.elapsedSeconds =  Math.floor((endTime - startTime) / 1000);
    // Consolidate and sort the tool times.
    const {toolTimes} = report.jobData;
    const toolTimeData = Object
    .keys(toolTimes)
    .sort((a, b) => toolTimes[b] - toolTimes[a])
    .map(tool => [tool, toolTimes[tool]]);
    report.jobData.toolTimes = {};
    toolTimeData.forEach(item => {
      report.jobData.toolTimes[item[0]] = item[1];
    });
  }
};
