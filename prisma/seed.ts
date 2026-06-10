// Seed: admin + brokers, realistic Indore inventory, sample leads & activity.
// Run: npm run db:seed   (idempotent-ish: upserts users, skips if properties exist)
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const db = new PrismaClient()

async function main() {
  const adminPhone = process.env.SEED_ADMIN_PHONE || '919826078459'
  const adminPassword = process.env.SEED_ADMIN_PASSWORD || 'saarthi123'
  const hash = await bcrypt.hash(adminPassword, 10)

  const admin = await db.user.upsert({
    where: { phone: adminPhone },
    update: {},
    create: { name: 'Piyush Mahajan', phone: adminPhone, role: 'ADMIN', passwordHash: hash },
  })
  const rajan = await db.user.upsert({
    where: { phone: '919876543210' },
    update: {},
    create: { name: 'Rajan Verma', phone: '919876543210', role: 'BROKER', passwordHash: hash },
  })
  const priya = await db.user.upsert({
    where: { phone: '919812345678' },
    update: {},
    create: { name: 'Priya Joshi', phone: '919812345678', role: 'BROKER', passwordHash: hash },
  })

  const existing = await db.property.count()
  if (existing > 0) {
    console.log(`Seed: ${existing} properties already present, skipping property seed.`)
    return
  }

  const P = (p: Record<string, unknown>) => p
  const props = [
    P({ title: '3 BHK Premium Flat in Vijay Nagar', type: 'FLAT', listingFor: 'SALE', bhk: 3, price: 8500000, area: 1650, locality: 'Vijay Nagar', address: 'Scheme 54 PU4, near C21 Mall', description: 'East-facing 3 BHK on the 7th floor with club house, covered parking and 24x7 security. Walking distance from C21 Mall and Medanta Hospital.', amenities: ['Club house', 'Covered parking', 'Power backup', 'Lift', 'Gym', '24x7 security'], furnishing: 'SEMI_FURNISHED', floor: '7th of 12', facing: 'East', ageYears: 3, featured: true, postedById: rajan.id, source: 'MANUAL', aiSummary: 'Well-priced 3 BHK near C21 Mall — strong family locality with good resale.', views: 142 }),
    P({ title: '2 BHK Ready-to-Move Flat in Nipania', type: 'FLAT', listingFor: 'SALE', bhk: 2, price: 5400000, area: 1100, locality: 'Nipania', address: 'Near Brilliant Convention Centre', description: 'Compact 2 BHK in a gated township with garden view. Ready to move, loan approved project.', amenities: ['Garden', 'Kids play area', 'Lift', 'Security'], furnishing: 'UNFURNISHED', floor: '3rd of 8', facing: 'North-East', ageYears: 1, featured: true, postedById: priya.id, source: 'MANUAL', aiSummary: 'Entry-level 2 BHK in fast-growing Nipania corridor.', views: 98 }),
    P({ title: '4 BHK Independent Bungalow in Saket', type: 'HOUSE', listingFor: 'SALE', bhk: 4, price: 27500000, area: 3200, locality: 'Saket', address: 'Saket Nagar, near Shreemaya', description: 'Corner bungalow with private lawn, modular kitchen and servant quarter. Premium old-Indore address.', amenities: ['Private lawn', 'Modular kitchen', 'Servant room', 'Bore + Narmada line'], furnishing: 'FURNISHED', facing: 'East', ageYears: 8, featured: true, postedById: rajan.id, source: 'MANUAL', aiSummary: 'Rare corner bungalow in Saket — premium segment, negotiable.', views: 211 }),
    P({ title: '2 BHK Flat for Rent in Mahalakshmi Nagar', type: 'FLAT', listingFor: 'RENT', bhk: 2, price: 18000, area: 1050, locality: 'Mahalakshmi Nagar', address: 'Near Bengali Square flyover', description: 'Semi-furnished 2 BHK with wardrobes and kitchen cabinets. Family preferred. Society with garden.', amenities: ['Wardrobes', 'Garden', 'Lift', 'Parking'], furnishing: 'SEMI_FURNISHED', floor: '2nd of 5', ageYears: 4, postedById: priya.id, source: 'WHATSAPP', rawText: '2bhk flat mahalakshmi nagar rent 18k semi furnished family only call 9812345678', aiNotes: 'Parsed from WhatsApp. Owner prefers family tenants.', views: 67 }),
    P({ title: '3 BHK Villa for Rent in Bicholi Mardana', type: 'VILLA', listingFor: 'RENT', bhk: 3, price: 35000, area: 2200, locality: 'Bicholi Mardana', address: 'Omaxe City 2', description: 'Independent villa in gated township with club membership. Pet friendly, ideal for working professionals.', amenities: ['Club house', 'Swimming pool', 'Pet friendly', 'Gated township'], furnishing: 'SEMI_FURNISHED', ageYears: 2, featured: true, postedById: rajan.id, source: 'MANUAL', views: 88 }),
    P({ title: '1500 sqft Plot in Rau', type: 'PLOT', listingFor: 'SALE', bhk: null, price: 4200000, area: 1500, locality: 'Rau', address: 'Rau-Pithampur Road, near IIM Indore', description: 'Clear-title residential plot in approved colony, 40 ft road, near IIM Indore. T&CP and RERA approved.', amenities: ['RERA approved', '40ft road', 'Boundary done'], source: 'EXCEL', postedById: priya.id, rawText: 'Row 4: Plot, Rau, 1500 sqft, 42L, clear title, RERA', aiNotes: 'Parsed from Excel sheet. Verify khasra number before visit.', views: 45 }),
    P({ title: '2 BHK Flat in Sukhliya', type: 'FLAT', listingFor: 'SALE', bhk: 2, price: 4500000, area: 980, locality: 'Sukhliya', address: 'Dewas Naka side', description: 'Budget-friendly 2 BHK near Dewas Naka industrial belt. Good rental yield potential.', amenities: ['Lift', 'Parking', 'Power backup'], furnishing: 'UNFURNISHED', floor: '5th of 9', ageYears: 5, postedById: rajan.id, source: 'WHATSAPP', rawText: '2bhk sukhliya 45 lakh 980 sqft 5th floor lift parking urgent sale', aiNotes: 'Owner says urgent sale — possible negotiation room.', views: 54 }),
    P({ title: 'Office Space on AB Road, Palasia', type: 'OFFICE', listingFor: 'RENT', bhk: null, price: 85000, area: 1800, locality: 'Palasia', address: 'AB Road, above ICICI Bank', description: 'Fully furnished plug-and-play office with 20 workstations, 2 cabins, conference room and reserved parking.', amenities: ['20 workstations', 'Conference room', 'AC', 'Lift', 'Parking'], furnishing: 'FURNISHED', floor: '2nd of 4', postedById: priya.id, source: 'MANUAL', views: 39 }),
    P({ title: '3 BHK Flat in Scheme 78', type: 'FLAT', listingFor: 'SALE', bhk: 3, price: 7200000, area: 1450, locality: 'Scheme 78', address: 'Near Vishesh Hospital', description: 'North-facing 3 BHK with two balconies and reserved parking. Society with intercom security.', amenities: ['2 balconies', 'Intercom', 'Parking', 'Lift'], furnishing: 'SEMI_FURNISHED', floor: '4th of 10', ageYears: 6, postedById: rajan.id, source: 'MANUAL', views: 76 }),
    P({ title: '1 BHK for Rent near Bhawarkua', type: 'FLAT', listingFor: 'RENT', bhk: 1, price: 9500, area: 550, locality: 'Bhawarkua', address: 'Near Holkar Science College', description: 'Compact 1 BHK ideal for students or working singles. Walking distance from coaching hub.', amenities: ['Water 24x7', 'Separate entry'], furnishing: 'UNFURNISHED', floor: '1st of 3', postedById: priya.id, source: 'WHATSAPP', rawText: '1bhk bhawarkua 9500 students ok near holkar college', views: 102 }),
    P({ title: 'Showroom on Khandwa Road', type: 'SHOP', listingFor: 'RENT', bhk: null, price: 125000, area: 2400, locality: 'Khandwa Road', address: 'Main road touch, near Bhanwarkuan square', description: 'Double-height showroom with 40 ft frontage on main Khandwa Road. Ideal for retail brands, banks or showrooms.', amenities: ['40ft frontage', 'Double height', 'Main road'], postedById: rajan.id, source: 'MANUAL', views: 31 }),
    P({ title: '2 BHK Flat in Silicon City', type: 'FLAT', listingFor: 'SALE', bhk: 2, price: 3900000, area: 950, locality: 'Silicon City', address: 'Near Rajendra Nagar railway station', description: 'Affordable 2 BHK in developing locality with good connectivity to Rau and bypass.', amenities: ['Parking', 'Security'], furnishing: 'UNFURNISHED', floor: '2nd of 4', ageYears: 7, postedById: priya.id, source: 'EXCEL', rawText: 'Row 7: 2BHK Silicon City 39L 950sqft', views: 58 }),
    P({ title: '5000 sqft Commercial Plot, Bypass', type: 'COMMERCIAL', listingFor: 'SALE', bhk: null, price: 32500000, area: 5000, locality: 'Bypass', address: 'Indore Bypass, near Star Square', description: 'Commercial plot with highway visibility, suitable for showroom, hotel or warehouse development.', amenities: ['Highway facing', 'Clear title'], postedById: rajan.id, source: 'MANUAL', views: 27 }),
    P({ title: '3 BHK Penthouse in New Palasia', type: 'FLAT', listingFor: 'SALE', bhk: 3, price: 14500000, area: 2400, locality: 'New Palasia', address: 'Near Industry House', description: 'Top-floor penthouse with 800 sqft private terrace, city views and 3 covered parkings. Premium central address.', amenities: ['Private terrace', '3 parkings', 'City view', 'Modular kitchen'], furnishing: 'FURNISHED', floor: '11th of 11', ageYears: 2, featured: true, postedById: priya.id, source: 'MANUAL', aiSummary: 'Trophy penthouse in central Indore — terrace is the differentiator.', views: 187 }),
  ]

  for (const p of props) {
    await db.property.create({
      data: {
        status: 'ACTIVE',
        city: 'Indore',
        ...(p as object),
        amenities: JSON.stringify((p as { amenities?: string[] }).amenities ?? []),
        images: '[]',
      } as never,
    })
  }

  // Sample leads in different pipeline stages
  const leadA = await db.lead.create({
    data: {
      name: 'Suresh Mehta', phone: '917000112233', source: 'WHATSAPP', status: 'WARM', score: 85,
      requirements: JSON.stringify({ listingFor: 'SALE', type: 'FLAT', bhk: 3, budgetMax: 9000000, localities: ['Vijay Nagar', 'Scheme 78'], timeline: '1-3 months', purpose: 'self-use' }),
      aiSummary: 'Family buyer, works near Vijay Nagar. Wants 3 BHK under ₹90L, ready for site visits on weekends.',
      assignedToId: rajan.id, brokerNotified: true,
    },
  })
  await db.message.createMany({
    data: [
      { leadId: leadA.id, direction: 'INBOUND', content: 'Hi, 3bhk chahiye Vijay Nagar side' },
      { leadId: leadA.id, direction: 'OUTBOUND', content: 'Namaste Suresh ji! Budget kya rakha hai aapne?' },
      { leadId: leadA.id, direction: 'INBOUND', content: '90 lakh tak' },
      { leadId: leadA.id, direction: 'OUTBOUND', content: 'Perfect — yeh 2 best options hain aapke liye 👇' },
      { leadId: leadA.id, direction: 'INBOUND', content: 'Pehli wali achhi lag rahi hai, weekend pe dekh sakte hain?' },
    ],
  })
  const vijayNagarFlat = await db.property.findFirst({ where: { locality: 'Vijay Nagar' } })
  if (vijayNagarFlat) {
    await db.leadMatch.create({ data: { leadId: leadA.id, propertyId: vijayNagarFlat.id, score: 92 } })
  }
  await db.activity.createMany({
    data: [
      { type: 'LEAD_CREATED', description: 'New WhatsApp lead from +917000112233', leadId: leadA.id },
      { type: 'MATCHES_SENT', description: 'Sent 2 matching properties', leadId: leadA.id },
      { type: 'STATUS_CHANGE', description: 'Status: QUALIFYING → WARM (auto, by AI qualifier)', leadId: leadA.id },
      { type: 'BROKER_NOTIFIED', description: 'Warm-lead alert sent to Rajan Verma (+919876543210)', leadId: leadA.id, userId: rajan.id },
    ],
  })

  const leadB = await db.lead.create({
    data: {
      name: null, phone: '917000445566', source: 'WHATSAPP', status: 'QUALIFYING', score: 40,
      requirements: JSON.stringify({ listingFor: 'RENT', bhk: 2, localities: [] }),
      aiSummary: 'Looking to rent a 2 BHK, budget and locality not shared yet.',
    },
  })
  await db.message.createMany({
    data: [
      { leadId: leadB.id, direction: 'INBOUND', content: '2 bhk rent pe chahiye' },
      { leadId: leadB.id, direction: 'OUTBOUND', content: 'Zaroor! Kaunsa area prefer karenge aur budget kya hai?' },
    ],
  })

  await db.lead.create({
    data: {
      name: 'Anita Sharma', phone: '917000778899', source: 'WEBSITE', status: 'COLD', score: 20,
      requirements: JSON.stringify({ listingFor: 'SALE', type: 'PLOT', localities: ['Rau'] }),
      aiSummary: 'Asked about plots in Rau, exploring only — timeline 1+ year.',
    },
  })

  console.log('Seed complete:')
  console.log(`  Admin login   -> phone: ${adminPhone}, password: ${adminPassword}`)
  console.log(`  Brokers       -> Rajan (919876543210), Priya (919812345678), same password`)
  console.log(`  Properties    -> ${props.length} active listings`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => db.$disconnect())
