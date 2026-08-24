import { sampleForm } from "./sample-form";
import { FormView } from "./components/FormView";

export default function App() {
  return (
    <main>
      <h1>EZScout</h1>
      <FormView definition={sampleForm} />
    </main>
  );
}
