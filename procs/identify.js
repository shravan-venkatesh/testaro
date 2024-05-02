/*
  © 2024 CVS Health and/or one of its affiliates. All rights reserved.

  Permission is hereby granted, free of charge, to any person obtaining a copy
  of this software and associated documentation files (the "Software"), to deal
  in the Software without restriction, including without limitation the rights
  to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
  copies of the Software, and to permit persons to whom the Software is
  furnished to do so, subject to the following conditions:

  The above copyright notice and this permission notice shall be included in all
  copies or substantial portions of the Software.

  THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
  IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
  FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
  AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
  LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
  OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
  SOFTWARE.
*/

/*
  identify.js
  Identifies the element of a standard instance.
*/

// IMPORTS

const {xPath} = require('playwright-dompath');

// FUNCTIONS

// Returns the bounding box of a locator.
const boxOf = async locator => {
  try {
    const isVisible = await locator.isVisible();
    if (isVisible) {
      const box = await locator.boundingBox({
        timeout: 50
      });
      if (box) {
        Object.keys(box).forEach(dim => {
          box[dim] = Math.round(box[dim], 0);
        });
        return box;
      }
      else {
        return null;
      }
    }
    else {
      return null;
    }
  }
  catch(error) {
    return null;
  }
}
// Returns a string representation of a bounding box.
const boxToString = box => {
  if (box) {
    return ['x', 'y', 'width', 'height'].map(dim => box[dim]).join(':');
  }
  else {
    return '';
  }
};
// Returns the XPath and box ID of the element of a standard instance.
exports.identify = async (instance, page) => {
  // Initialize a result.
  const elementID = {
    boxID: '',
    xPath: ''
  };
  const {tagName, location, excerpt} = instance;
  const {type, spec} = location;
  // If the instance specifies a bounding box:
  if (type === 'box') {
    // Add it to the result.
    elementID.boxID = boxToString(spec);
  }
  // Otherwise, if the instance specifies a selector or XPath location:
  else if (['selector', 'xpath'].includes(type)) {
    // Get a locator of the element.
    const specifier = location.type === 'xpath'
    ? `xpath=${spec.replace(/\/text\(\)\[\d+\]$/, '')}`
    : spec;
    const locator = page.locator(specifier).first();
    // Add the bounding box of the element to the result.
    const box = await boxOf(locator);
    elementID.boxID = boxToString(box);
    // Add the XPath of the element to the result.
    elementID.pathID = await xPath(locator);
  }
  // If either ID remains undefined and the instance specifies both a tag name and an excerpt:
  if (tagName && excerpt && ! (elementID.boxID && elementID.pathID)) {
    // Get the plain text parts of the excerpt, converting ... to an empty string.
    const minTagExcerpt = excerpt.replace(/<[^>]+>/g, '<>');
    const plainParts = (minTagExcerpt.match(/[^<>]+/g) || [])
    .map(part => part === '...' ? '' : part);
    // Get the longest of them.
    const sortedPlainParts = plainParts.sort((a, b) => b.length - a.length);
    const mainPart = sortedPlainParts.length ? sortedPlainParts[0] : '';
    const compactMainPart = mainPart.trim().replace(/\s{2,}/g, ' ');
    // Get locators for matching elements.
    const locators = page.locator(tagName.toLowerCase(), {hasText: compactMainPart});
    // If there is exactly 1 of them:
    const locatorCount = await locators.count();
    if (locatorCount === 1) {
      // Add the box ID of the element to the result if none exists yet.
      if (! elementID.boxID) {
        const box = await boxOf(locators);
        elementID.boxID = boxToString(box);
      }
      // Add the path ID of the element to the result if none exists yet.
      if (! elementID.pathID) {
        elementID.pathID = await xPath(locators);
      }
    }
  }
  // Return the result.
  return elementID;
};
