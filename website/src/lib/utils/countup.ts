export function countUp(): void {
  const elements = document.querySelectorAll<HTMLElement>("[data-countup]");

  // Easing functions
  const easeOut = (t: number) => 1 - Math.pow(1 - t, 3); // cubic ease-out
  const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2); // cubic ease-in-out

  // Function to get the easing function based on the attribute
  function getEasingFunction(easing: string | null) {
    switch (easing) {
      case "ease-out":
        return easeOut;
      case "ease-in-out":
        return easeInOut;
      default:
        return (t: number) => t; // Linear easing by default
    }
  }

  function animateCountUp(element: HTMLElement): void {
    const endValue = parseInt(element.getAttribute("data-countup-number")!, 10);
    const duration = parseInt(element.getAttribute("data-countup-duration")!, 10);
    const easingType = element.getAttribute("data-countup-easing") || "linear"; // default to linear
    const easingFunction = getEasingFunction(easingType);

    let startTime: number | null = null;
    let startValue = 0;

    function step(timestamp: number): void {
      if (!startTime) startTime = timestamp;
      const progress = timestamp - startTime;
      const progressPercent = Math.min(progress / duration, 1);
      const easedProgress = easingFunction(progressPercent); // Apply the easing function
      const currentValue = Math.floor(easedProgress * (endValue - startValue) + startValue);
      element.textContent = currentValue.toString();

      if (progress < duration) {
        requestAnimationFrame(step);
      } else {
        element.textContent = endValue.toString(); // Ensure the final number is exact
      }
    }

    requestAnimationFrame(step);
  }

  const observerOptions: IntersectionObserverInit = {
    threshold: 1, // Trigger when 100% of the element is in view
  };

  function handleIntersection(entries: IntersectionObserverEntry[], observer: IntersectionObserver): void {
    entries.forEach((entry) => {
      if (entry.isIntersecting && !entry.target.hasAttribute("data-countup-done")) {
        animateCountUp(entry.target as HTMLElement);
        entry.target.setAttribute("data-countup-done", "true"); // Mark the element to prevent re-animation
        observer.unobserve(entry.target); // Stop observing once the animation is complete
      }
    });
  }

  const observer: IntersectionObserver = new IntersectionObserver(handleIntersection, observerOptions);

  elements.forEach((element) => {
    observer.observe(element);
  });
}
