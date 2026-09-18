import { NextResponse } from "next/server";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function GET() {
  try {
    const { data, error } = await resend.emails.send({
      from: "Circa Lucia <onboarding@resend.dev>",
      to: ["contact.circalucia@gmail.com"],
      subject: "Circa Lucia — Resend Test",
      html: `
        <h2>Circa Lucia</h2>
        <p>This is a test email from your Circa Lucia website.</p>
        <p>Resend is successfully connected.</p>
      `,
    });

    if (error) {
      return NextResponse.json(
        { success: false, error },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Test email sent successfully.",
      data,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Unknown error",
      },
      { status: 500 }
    );
  }
}