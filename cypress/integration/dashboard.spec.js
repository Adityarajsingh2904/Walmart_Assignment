/// <reference types="cypress" />

const alertPayload = {
  id: 'alert-1',
  title: 'High-severity test alert',
  severity: 'high',
  timestamp: new Date().toISOString(),
};

describe('Dashboard', () => {
  it('renders high severity alert and updates CPU gauge', () => {
    cy.intercept('/api/metrics', {
      cpuUsage: 42,
      memUsage: 58,
      reqRate: 5,
    }).as('getMetrics');

    cy.visit('/dashboard');

    cy.window().then((win) => {
      if (win.socket) {
        win.socket.emit('alertCreated', alertPayload);
      }
    });

    cy.contains('High-severity test alert').should('be.visible');

    cy.wait('@getMetrics');

    cy.contains('42').should('exist');
  });
});
