import { NextRequest, NextResponse } from "next/server";
import { extractPDF } from "@/lib/pro/pdf-extractor";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const fileName = file.name.toLowerCase();
    if (!fileName.endsWith(".pdf")) {
      return NextResponse.json(
        { error: "Only PDF files are supported in Pro mode" },
        { status: 400 }
      );
    }

    const buffer = await file.arrayBuffer();
    const extracted = await extractPDF(buffer, file.name);

    return NextResponse.json({
      success: true,
      data: extracted,
    });
  } catch (err) {
    console.error("[Pro Parse Error]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to parse PDF" },
      { status: 500 }
    );
  }
}
