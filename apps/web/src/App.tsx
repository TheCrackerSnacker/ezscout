import { sampleForm } from "./sample-form";
import { FormView } from "./components/FormView";
import { FormLoader } from "./components/FormLoader";
import { AdminPage } from "./admin/AdminPage";
import { Link, useRoute } from "./router";

export default function App() {
  const route = useRoute();

  return (
    <main>
      <h1>EZScout</h1>
      <p>
        <Link to="/">Home</Link> · <Link to="/admin">Admin</Link>
      </p>
      {route.page === "home" ? (
        <>
          <p>Developer preview — a sample form exercising every question type.</p>
          <FormView definition={sampleForm} />
        </>
      ) : null}
      {route.page === "form" ? (
        <FormLoader key={route.formId} formId={route.formId} />
      ) : null}
      {route.page === "admin" ? <AdminPage /> : null}
    </main>
  );
}
