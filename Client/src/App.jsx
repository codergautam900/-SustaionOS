import React from "react";
import { BrowserRouter } from "react-router-dom";
import AppRoutes from "./routes/App.Routes";
import AppErrorBoundary from "./components/app/AppErrorBoundary";

function App() {
  return (
    <AppErrorBoundary>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AppErrorBoundary>
  );
}

export default App;
