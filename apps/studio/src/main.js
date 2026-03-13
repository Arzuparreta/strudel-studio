export async function renderApp(container) {
  const React = await import("react");
  const ReactDOM = await import("react-dom/client");
  const { default: App } = await import("./App.tsx");

  ReactDOM.createRoot(container).render(
    React.createElement(
      React.StrictMode,
      null,
      React.createElement(App, null),
    ),
  );
}

