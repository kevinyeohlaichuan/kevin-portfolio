import type { Metadata } from "next";
import { CardClient } from "../components/CardClient";

export const metadata: Metadata = {
  title: "Kevin Yeoh — Digital Card",
  description: "Kevin Yeoh builds full-stack architectural visualisation products and games.",
};

export default function CardPage() {
  return <CardClient />;
}
