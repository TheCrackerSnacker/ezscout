import { sampleForm } from "./sample-form";
import { FormView } from "./components/FormView";
import { FormLoader } from "./components/FormLoader";
import { useHashRoute } from "./useHashRoute";

export default function App() {
  const route = useHashRoute();

  return (
    <main>
      <h1>EZScout</h1>
      {route.page === "home" ? (
        <>
          <p>Developer preview — a sample form exercising every question type.</p>
          <FormView definition={sampleForm} />
        </>
      ) : (
        <FormLoader key={route.formId} formId={route.formId} />
      )}
    </main>
  );
}
