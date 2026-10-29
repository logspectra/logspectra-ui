import { Suspense } from "react";
import RootRedirectPage from "./root-redirect";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <RootRedirectPage />
    </Suspense>
  );
}
