export default async function handler(req: Request) {
  const body = await req.json();
  console.log('Beacon received:', body.event);

  return new Response(null, { status: 204 });
}

export const config = { path: "/api/beacon" };