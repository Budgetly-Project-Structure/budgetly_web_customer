

public class App {
    public static void main(String[] args){
        int[] numbers = {-2, -10, -4, -8};
        int[] numbers2 = {20, 25, 30, 2};
        System.out.println("Reversed: " + reversedString("Hello"));
        System.out.println("Highest number: " + findLargest(numbers));
        System.out.println("Amount of evens: " + countEvens(numbers));
        System.out.println("Is the number found in the array? " + findNumber(numbers, -20));
        System.out.println("Range of this array is: " + range(numbers2));
        System.out.println("Sum of positive array: " + sumPositive(numbers2));
        System.out.println("Second largest in this array is: " + secondLargest(numbers2));
        System.out.println("Count in this string for the letter 'i' is: " + countCharacter("This is a test", 'i'));
    }
    public static int countCapitals(String text){
        char letter;
        int count = 0;
        for(int i = 0; i < text.length(); i++){
            letter = text.charAt(i);
            if(Character.isUpperCase(letter)){
                count++;
            }
        }
        return count;
    }

    public static String getCapitals(String text){
        char letter;
        String capitals = "";
        for(int i = 0; i < text.length(); i++){
            letter = text.charAt(i);
            if(Character.isUpperCase(letter)){
                capitals += letter;
            }
        }
        return capitals;
    }


    public static int countVowels(String text){
        int count = 0;
        char letter;
        for(int i = 0; i < text.length(); i++){
            letter = text.charAt(i);
            if(letter == 'a' || letter == 'e' || letter == 'i' || letter == 'o' || letter == 'u' 
                || letter == 'E' || letter == 'E' || letter == 'I' || letter == 'O' || letter == 'U'
            ){
                count++;
            }
        }
        return count;
    }

    public static String reversedString(String text){
        char letter;
        String reversed ="";
        for(int i = text.length()-1; i >= 0; i--){
            letter=text.charAt(i);
            reversed += letter;
        }
        return reversed;
    }
    public static int findLargest(int[] numbers){
        int largest = numbers[0];
        int highest = numbers[0];
        for(int i = 0; i < numbers.length; i++){
            highest = numbers[i];
        if(highest > largest){
            largest = highest;
        }
        }
        return largest;
    }

    public static int countEvens(int[] numbers){
        int count = 0;
        for(int i = 0; i < numbers.length; i++){
            int currentIndex = numbers[i];
            if(currentIndex % 2 == 0){
                count++;
            }
        }
        return count;
    }

    public static boolean findNumber(int[] numbers, int target){
        boolean found = false;
        for(int i = 0; i < numbers.length; i++){
            if(numbers[i] == target){
                found = true;
            }
        }
        return found;
    }

    public static int countOccurences(int[] numbers, int target){
        int count = 0;
        for(int i = 0; i < numbers.length; i++){
            if(numbers[i] == target){
                count++;
            }
        }
        return count;
    }

    public static int range(int[] numbers){
        int largest = numbers[0];
        int smallest = numbers[0];
        int mid = numbers[0];
        for(int i = 0; i < numbers.length; i++){
            mid = numbers[i];
            if(mid > largest){
                largest = mid;
            }else if(mid < smallest){
                smallest = mid;
            }
        }
        return largest - smallest;
    
    }

    public static int sumPositive(int[] numbers){
        int sum = 0;
    
        for(int i = numbers.length - 1; i >= 0; i--){
            int current = numbers[i];
            if(current > 0){
                sum += current;
            }
        }
        return sum;
    }

    public static int secondLargest(int[] numbers){
        int secondLargest = numbers[0];
        int largest = numbers[0];

        for(int i = 0; i < numbers.length; i++){
            int current = numbers[i];
            if(current > largest){
                secondLargest = largest;
                largest = current;
            }else if(current > secondLargest && current != largest){
                secondLargest = current;
            }
        }
        return secondLargest;
    }

    public static int countCharacter(String text, char target){
        char current;
        int count = 0;
        
        for(int i = 0; i < text.length(); i++){
            current = text.charAt(i);
            if(current == target){
                count++;
            }
        }
        return count;
    }
}
