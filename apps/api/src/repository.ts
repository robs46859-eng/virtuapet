import type { PetProfile } from "@virtuapet/contracts";

export interface PetRepository {
  create(profile: PetProfile): Promise<PetProfile>;
  findById(petId: string): Promise<PetProfile | undefined>;
  clear(): Promise<void>;
}

export class MemoryPetRepository implements PetRepository {
  private readonly pets = new Map<string, PetProfile>();

  async create(profile: PetProfile): Promise<PetProfile> {
    this.pets.set(profile.petId, structuredClone(profile));
    return structuredClone(profile);
  }

  async findById(petId: string): Promise<PetProfile | undefined> {
    const profile = this.pets.get(petId);
    return profile ? structuredClone(profile) : undefined;
  }

  async clear(): Promise<void> {
    this.pets.clear();
  }
}

