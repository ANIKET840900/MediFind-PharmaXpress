# PharmaXpress Spring Backend

This directory contains the Java Spring Boot backend.

## Open in IntelliJ IDEA

1. Open the `spring-backend` folder as a Maven project.
2. Set the project SDK to Java 17.
3. Run `com.medifind.pharmaxpress.PharmaXpressApplication`.

## Run from PowerShell

If `mvn` is not on PATH, use the Maven installed under your user profile:

```powershell
& "$env:USERPROFILE\.local\maven\apache-maven-3.9.9\bin\mvn.cmd" spring-boot:run
```

Run verification with:

```powershell
& "$env:USERPROFILE\.local\maven\apache-maven-3.9.9\bin\mvn.cmd" test
```

## Local Seed Data

The default H2 profile creates demo data when the database is empty:

- Admin: `admin` / `admin123`
- Seller: `seller` / `seller123`
- Buyer: `buyer` / `buyer123`

The MySQL profile disables seed data by default. Enable it with `app.seed.enabled=true` only for non-production databases.

## Notes

- The backend uses opaque token auth and accepts `Authorization: Token <token>` to match the existing React client.
- H2 is configured for local development at `jdbc:h2:file:./data/pharmaxpress`.
- Uploaded prescription files are written under `uploads/prescriptions`.
- JPA/Hibernate owns schema creation in development, so separate SQL DDL is not required for the current model.
