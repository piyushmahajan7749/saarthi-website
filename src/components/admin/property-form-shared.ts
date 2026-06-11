// Shared types + default-value factory for the property form. Kept OUT of the
// 'use client' PropertyForm module so server components (the "new listing" page)
// can call emptyValues() directly — calling a function exported from a
// 'use client' file across the server boundary throws at runtime.

export interface BrokerOpt {
  id: string
  name: string
  role: string
}

export interface PropertyFormValues {
  id?: string
  title: string
  type: string
  listingFor: string
  bhk: string
  price: string
  area: string
  areaUnit: string
  furnishing: string
  floor: string
  facing: string
  ageYears: string
  locality: string
  city: string
  address: string
  amenities: string[]
  images: string // newline-separated urls
  videos: string // newline-separated urls
  description: string
  ownerName: string
  ownerPhone: string
  status: string
  featured: boolean
  postedById: string
  adminNotes: string
}

export function emptyValues(brokerId?: string): PropertyFormValues {
  return {
    title: '', type: 'FLAT', listingFor: 'SALE', bhk: '', price: '', area: '', areaUnit: 'sqft',
    furnishing: '', floor: '', facing: '', ageYears: '', locality: '', city: 'Indore', address: '',
    amenities: [], images: '', videos: '', description: '', ownerName: '', ownerPhone: '', status: 'ACTIVE',
    featured: false, postedById: brokerId ?? '', adminNotes: '',
  }
}
