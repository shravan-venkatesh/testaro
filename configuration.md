# Configuration

Every tool in testaro must have:
- A property in the tests object defined in the run.js file, where the property name is the code representing the tool and the value is the name of the pool.
- A .js file, defining the operation of the tool, in the tests directory, whose name base is the name of the tool

In the actSpecs.js, define a test act, namely : 

```
test: [
  'Perform a test',
  {
    which: [true, 'string', 'isTest', 'test name'],
    rules: [false, 'array', 'areStrings', 'rule IDs or specifications, if not all']
    what: [false, 'string', 'hasLength', 'comment']
  }
],
```
The test act must have these properties:
- ``which``: string valued property naming a tool 
- ``rules``: array valued property restricting the tests to be reported
-  ``what``: A string valued property describing the tool