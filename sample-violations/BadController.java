import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;
import java.util.List;
import java.util.stream.Collectors;
import java.util.Date;

// DELIBERATELY BAD — will FAIL MVC adherence checks
// Violations: business logic in controller, repo injected directly, no @Valid, returns @Entity

@RestController
@RequestMapping("/api/users")
public class UserController {

    // VIOLATION: Repository injected directly — must go through Service layer
    @Autowired
    private UserRepository userRepository;

    // VIOLATION: business logic + validation in controller
    // VIOLATION: @RequestBody has no @Valid
    // VIOLATION: returns @Entity (User) not a DTO
    @PostMapping
    public User createUser(@RequestBody User user) {
        if (user.getName() == null || user.getName().isEmpty()) {
            throw new RuntimeException("Name is required");
        }
        if (user.getEmail() == null || !user.getEmail().contains("@")) {
            throw new RuntimeException("Invalid email format");
        }

        // VIOLATION: query logic + business rule inside controller
        List<User> existing = userRepository.findByEmail(user.getEmail());
        if (!existing.isEmpty()) {
            throw new RuntimeException("Email already registered");
        }

        user.setStatus("PENDING");
        user.setCreatedAt(new Date());
        if (user.getRole() == null) user.setRole("USER");

        return userRepository.save(user);  // returns @Entity — leaks internal model
    }

    // VIOLATION: complex stream/filter processing belongs in Service layer
    @GetMapping("/premium-active")
    public List<User> getPremiumActiveUsers() {
        return userRepository.findAll().stream()
            .filter(u -> u.getSubscription() != null)
            .filter(u -> u.getSubscription().isPremium())
            .filter(User::isActive)
            .collect(Collectors.toList());
    }
}
