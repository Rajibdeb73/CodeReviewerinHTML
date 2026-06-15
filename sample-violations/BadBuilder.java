// DELIBERATELY BAD — will FAIL Builder adherence checks
// Violations: non-static Builder, no fluent chaining, no validation in build(),
//             public constructor, mutable fields

public class UserProfile {

    // VIOLATION: fields are not final — product is mutable after construction
    private String name;
    private String email;
    private int age;

    // VIOLATION: public constructor defeats the Builder pattern
    public UserProfile() { }

    public UserProfile(String name, String email, int age) {
        this.name = name;
        this.email = email;
        this.age = age;
    }

    // VIOLATION: Builder is NOT static — requires outer UserProfile instance to construct
    public class Builder {
        private String name;
        private String email;
        private int age;

        // VIOLATION: returns void, not Builder — callers cannot chain calls
        public void name(String name) {
            this.name = name;   // should: return this;
        }

        public void email(String email) {
            this.email = email; // should: return this;
        }

        public void age(int age) {
            this.age = age;     // should: return this;
        }

        // VIOLATION: no validation — null name/email silently produces a broken object
        public UserProfile build() {
            return new UserProfile(name, email, age);  // no Objects.requireNonNull
        }
    }
}
