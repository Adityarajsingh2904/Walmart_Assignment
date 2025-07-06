/// <reference types="cypress" />

describe('Accessibility checks', () => {
  const pages = ['/dashboard', '/anomaly-viewer'];

  pages.forEach((page) => {
    it(`has no detectable a11y violations on ${page}`, () => {
      cy.visit(page);
      cy.injectAxe();
      cy.checkA11y(null, {
        runOnly: {
          type: 'tag',
          values: ['wcag2aa'],
        },
      });
    });
  });
});
