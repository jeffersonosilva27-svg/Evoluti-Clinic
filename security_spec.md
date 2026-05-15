# Security Specification for ClinicaSync

## 1. Data Invariants
- No patient can be created without being linked to a valid Clinic.
- An appointment must be linked to a Clinic, a Professional, and a Patient.
- Evolutions and Assessments are clinical data and must NOT be accessible to Receptionists.
- Users can only access data (read or write) if their user profile has the corresponding `clinicId` in their `clinics` list.
- SUPER_GESTOR is the only role that can see data across all clinics.

## 2. The "Dirty Dozen" Payloads (Unauthorized Attempts)

1. **Identity Spoofing**: A Professional trying to change their own role to SUPER_GESTOR.
2. **Cross-Tenant Read**: A Professional from Clinic A trying to read a Patient from Clinic B.
3. **Privilege Escalation**: A Receptionist trying to read an Evolution record.
4. **Orphaned Write**: Creating a Patient without a `clinicId`.
5. **Data Poisoning**: Injecting a 2MB string into a patient's name.
6. **Timeline Fraud**: Setting a `createdAt` date in the past for an Evolution.
7. **Financial Leak**: A Professional trying to read the clinic's total financial outcomes (if they aren't theirs, though usually Gestors see this).
8. **Malicious Update**: Changing a `patientId` on an existing Evolution to link it to a different patient.
9. **Role Bypass**: A standard user trying to create a new Clinic document.
10. **State Skipping**: Manually setting an appointment status to 'attended' without being the assigned professional or gestor.
11. **Shadow Field**: Adding a `isVerified: true` field to a user profile during signup.
12. **Bulk Leak**: Querying all Patients across the system without filtering by Clinic.

## 3. Test Runner (Draft Logic)

Tests will verify:
- `ALLOW` if `auth.uid` is in `users` table and `resource.data.clinicId` is in `user.clinics`.
- `DENY` if `user.role` is `RECEPCIONISTA` and path is `/evolutions/`.
- `DENY` if `update` field includes `role` and user is not `SUPER_GESTOR`.
