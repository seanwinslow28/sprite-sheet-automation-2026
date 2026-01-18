#### **1\. The Choreographer (Architect)**

* **Role:** Defines the physical mechanics of the move.  
* **Input:** "Heavy Kick".  
* **Output:** "Side profile. Torso twists 45 degrees. Right leg extended at 110-degree angle. Left leg planted. Arms counter-balancing."

#### **2\. The Editor (The New Artist)**

* **Role:** Modifies the base asset into the new pose.  
* **Model:** Best model for editing and consistency.  
* **Action:** Uses **Subject Customization**. You send the `Champion-Sean-anchor.png` as a `referenceImage` with the type `subject`.  
* **Prompt:** "Generate a sprite of \[subject\] performing a \[Choreographer's Description\]. Solid white background. 16-bit fighting pixel art style."  
* *Note: This "locks" the identity of Sean so you don't get random variations.*

#### **3\. The Auditor (The Critic)**

* **Role:** Verifies pixel-perfect details.  
* **Model:** Best **Vision Model** capable of understanding art style and sprite sheet quality. "Looks" at the generated sprite sheet, compares it to the *Style Guide*, and outputs a `PASS` or `REJECT` with specific feedback.  
* **Action:** "Look at this new kick sprite vs. the original base sprite."  
* **Check:** "Did the bandana color change? Did the boots turn into shoes? Is the pixel resolution consistent?"

