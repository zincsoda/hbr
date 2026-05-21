import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

jest.mock('axios', () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
  },
}));

import App from './App';

const axiosMock = jest.requireMock('axios').default;

function mockEtaResponses() {
  axiosMock.get.mockImplementation((url) => {
    if (typeof url !== 'string' || !url.includes('/eta/')) {
      return Promise.reject(new Error(`Unexpected request: ${url}`));
    }
    return Promise.resolve({ status: 200, data: { data: [] } });
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockEtaResponses();
  window.localStorage.clear();
});

test('shows bus signage after ETAs finish loading', async () => {
  render(<App />);
  expect(screen.getByText(/loading bus routes/i)).toBeInTheDocument();

  await waitFor(() => {
    expect(screen.queryByText(/loading bus routes/i)).not.toBeInTheDocument();
  });

  expect(screen.getByText(/current time/i)).toBeInTheDocument();
});

test('signage shell uses dark green background', async () => {
  const { container } = render(<App />);

  await waitFor(() => {
    expect(screen.queryByText(/loading bus routes/i)).not.toBeInTheDocument();
  });

  const signage = container.querySelector('.signage-container');
  expect(signage).toBeTruthy();

  expect(signage).toHaveStyle({
    backgroundImage:
      'linear-gradient(135deg, rgb(10, 40, 24) 0%, rgb(22, 76, 47) 100%)',
  });
});

test('adds a configurable route/stop panel from the add-route form', async () => {
  render(<App />);

  await waitFor(() => {
    expect(screen.queryByText(/loading bus routes/i)).not.toBeInTheDocument();
  });

  expect(screen.queryByText(/^My bespoke route$/i)).not.toBeInTheDocument();

  await userEvent.click(screen.getByRole('button', { name: /add route \/ stop/i }));

  await userEvent.type(screen.getByRole('textbox', { name: /route number/i }), '968');
  await userEvent.type(screen.getByRole('textbox', { name: /^stop id$/i }), 'DUMMYSTOP99');
  await userEvent.selectOptions(screen.getByRole('combobox', { name: /direction/i }), 'inbound');
  await userEvent.type(screen.getByRole('textbox', { name: /stop display name/i }), 'Kwai Fong');
  await userEvent.type(screen.getByRole('textbox', { name: /destination \(filter\)/i }), 'Tuen Mun');
  await userEvent.type(screen.getByRole('textbox', { name: /route display name/i }), 'My bespoke route');

  await userEvent.click(screen.getByRole('button', { name: /add to display/i }));

  await waitFor(() => {
    expect(screen.getByText(/^My bespoke route$/i)).toBeInTheDocument();
  });

  expect(screen.getByText(/^Kwai Fong$/i)).toBeInTheDocument();

  await waitFor(() => {
    const routeNumbers = screen.getAllByText(/^968$/i);
    expect(routeNumbers.length).toBeGreaterThanOrEqual(1);
  });

  await userEvent.click(screen.getByRole('button', { name: /hide add route/i }));
  await waitFor(() => {
    expect(screen.queryByRole('button', { name: /add to display/i })).not.toBeInTheDocument();
  });
});

test('blocks submit when mandatory fields are missing', async () => {
  render(<App />);

  await waitFor(() => {
    expect(screen.queryByText(/loading bus routes/i)).not.toBeInTheDocument();
  });

  await userEvent.click(screen.getByRole('button', { name: /add route \/ stop/i }));
  await userEvent.click(screen.getByRole('button', { name: /add to display/i }));

  await waitFor(() => {
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });
});
