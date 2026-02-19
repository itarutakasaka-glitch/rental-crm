import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

export async function GET() {
  const org = await prisma.organization.findUnique({ where: { id: "org_default" } });
  return NextResponse.json(org);
}

export async function PUT(req: NextRequest) {
  const data = await req.json();
  const org = await prisma.organization.update({
    where: { id: "org_default" },
    data: { name: data.name, phone: data.phone, email: data.email, address: data.address, website: data.website, storeName: data.storeName, storeAddress: data.storeAddress, storePhone: data.storePhone, storeHours: data.storeHours, storeAccess: data.storeAccess, logoUrl: data.logoUrl, lineUrl: data.lineUrl, licenseNumber: data.licenseNumber },
  });
  return NextResponse.json(org);
}
