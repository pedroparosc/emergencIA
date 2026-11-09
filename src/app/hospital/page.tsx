import type { Metadata } from "next";
import { Dashboard } from "./Dashboard";

export const metadata: Metadata = {
  title: "Painel do hospital",
  description: "Chamados recebidos pelo emergencIA em tempo real.",
  robots: { index: false, follow: false },
};

export default function HospitalPage() {
  return <Dashboard />;
}
