import { useEffect, useState } from "react";
import { fetchAdminForms, type AdminFormSummary } from "../api";
import { Link, navigate } from "../router";

export function FormsListPage() {
  const [forms, setForms] = useState<AdminFormSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetchAdminForms()
      .then((rows) => {
        if (!cancelled) setForms(rows);
      })
      .catch(() => {
        if (!cancelled) setForms([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section className="card">
      <div className="row" style={{ justifyContent: "space-between", alignItems: "baseline" }}>
        <h2>Existing forms</h2>
        <button type="button" onClick={() => navigate("/admin/new")}>
          Create new form
        </button>
      </div>
      {loading ? (
        <p className="text-muted">Loading…</p>
      ) : forms.length === 0 ? (
        <p className="text-muted">No forms yet. Create one to get started.</p>
      ) : (
        <table className="forms-table">
          <thead>
            <tr>
              <th>Title</th>
              <th>Version</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {forms.map((form) => (
              <tr key={form.id}>
                <td>{form.title}</td>
                <td>{form.publishedVersion ?? "draft"}</td>
                <td>
                  <Link to={`/admin/edit/${form.id}`}>edit</Link>{" "}
                  <span style={{ marginLeft: "15px" }}>
                    <Link to={`/form/${form.id}`}>view</Link>
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
