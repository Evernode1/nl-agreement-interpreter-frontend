import { Route, Routes } from "react-router-dom";
import { Layout } from "./components/Layout";
import { ToastViewport } from "./components/ui";
import { Landing } from "./pages/Landing";
import { NewAgreement } from "./pages/NewAgreement";
import { Dashboard } from "./pages/Dashboard";
import { Explore } from "./pages/Explore";
import { AgreementDetail } from "./pages/AgreementDetail";
import { NotFound } from "./pages/NotFound";

export default function App() {
  return (
    <>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Landing />} />
          <Route path="/new" element={<NewAgreement />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/explore" element={<Explore />} />
          <Route path="/agreement/:id" element={<AgreementDetail />} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
      <ToastViewport />
    </>
  );
}
