import type { Metadata } from "next";
import { Simulator } from "./Simulator";

export const metadata: Metadata = {
  title: "Simulador",
  description: "Teste a conversa do emergencIA no navegador, sem precisar do WhatsApp.",
};

export default function SimulatorPage() {
  return <Simulator />;
}
