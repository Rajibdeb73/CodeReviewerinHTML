// DELIBERATELY BAD — will FAIL Singleton adherence checks
// Violations: public constructor, no volatile, public instance field, not thread-safe

public class BadSingleton {

    // VIOLATION 1: public field — anyone can overwrite the instance
    public static BadSingleton instance;

    // VIOLATION 2: public constructor — anyone can create new instances
    public BadSingleton() {
        System.out.println("Creating BadSingleton - breaks the pattern!");
    }

    // VIOLATION 3: no synchronization — race condition on first call
    // VIOLATION 4: no volatile on instance field — broken under Java Memory Model
    public static BadSingleton getInstance() {
        if (instance == null) {
            instance = new BadSingleton(); // Not thread-safe!
        }
        return instance;
    }

    public void doWork() {
        System.out.println("Working... but I might not be the only instance!");
    }
}
