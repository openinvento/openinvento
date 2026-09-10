import { Button } from "@/components/ui/button";
import { useRouteError, Link } from "react-router";

export default function ErrorPage() {
  const error = useRouteError() as Error;
  console.error(error);

  return (
    <div style={{ padding: "40px", textAlign: "center" }}>
      <h1><b>Error</b></h1>
      <p>Something went wrong.</p>
      <p>
        <i>{error.name || error.message}</i>
      </p>
      <Button>
        <Link to="/">Zurück zur Startseite</Link>
      </Button>
    </div>
  );
}
