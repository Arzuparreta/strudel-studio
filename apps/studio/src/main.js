export async function renderApp(container) {
  const React = await import("react");
  const ReactDOM = await import("react-dom/client");
  const { default: App } = await import("./App.js");

  ReactDOM.createRoot(container).render(
    React.createElement(
      React.StrictMode,
      null,
      React.createElement(App, null),
    ),
  );
}

