import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    
    const backendRes = await fetch('https://djbgov4u.co.in/api/complaint', {
      method: 'POST',
      headers: {
        'accept': '*/*',
        'x-api-key': 'djb_JacbbHctpelUcVtfZuGFkGIYtTFS4dT5i3kuZEr5Zzs',
      },
      body: formData,
    });

    const text = await backendRes.text();
    try {
      const data = JSON.parse(text);
      return NextResponse.json(data, { status: backendRes.status });
    } catch (e) {
      return new NextResponse(text, { status: backendRes.status, headers: { 'Content-Type': 'text/plain' } });
    }
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    
    const backendRes = await fetch(`https://djbgov4u.co.in/api/complaint?${searchParams.toString()}`, {
      method: 'GET',
      headers: {
        'accept': '*/*',
        'x-api-key': 'djb_JacbbHctpelUcVtfZuGFkGIYtTFS4dT5i3kuZEr5Zzs',
      },
    });

    const text = await backendRes.text();
    try {
      const data = JSON.parse(text);
      return NextResponse.json(data, { status: backendRes.status });
    } catch (e) {
      return new NextResponse(text, { status: backendRes.status, headers: { 'Content-Type': 'text/plain' } });
    }
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
